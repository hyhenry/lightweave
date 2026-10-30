// Controllers: live status, keeping LED counts in step with WLED, and sound passthrough.

import type { AudioMode, Device, DeviceStatus } from '../shared/types.ts';
import { getInfo, getState } from './wled/client.ts';
import { getAudio, linkAudio, unlinkAudio } from './wled/audio.ts';
import { store } from './store.ts';
import * as player from './player.ts';

const STATUS_TIMEOUT_MS = 1500;
const LED_SYNC_INTERVAL_MS = 60_000;

/** The given devices, or all of them when no ids are given. */
export function selectDevices(ids: unknown): Device[] {
  const all = store.devices();
  return Array.isArray(ids) && ids.length ? all.filter((d) => ids.includes(d.id)) : all;
}

/**
 * WLED is the source of truth for how many lights a controller has. Pick up
 * changes made in WLED's LED settings and re-send the current pattern to fit.
 */
async function syncLedCount(d: Device, ledCount: number) {
  if (!ledCount || ledCount === d.ledCount) return;
  const updated = store.updateDevice(d.id, { ledCount });
  if (updated) await player.refresh(updated).catch(() => {});
}

/** What we last heard from a controller itself. */
type Live = Pick<DeviceStatus, 'online' | 'power' | 'audio'>;

const AUDIO_TTL_MS = 60_000; // AudioReactive settings rarely change, and reading them is the slowest call
const QUICK_MS = 600; // past this, answer with the last known status and keep checking in the background

const audioCache = new Map<string, { mode: AudioMode; at: number }>();
const lastLive = new Map<string, Live>();
const inflight = new Map<string, Promise<Live>>();

/** Re-read a controller's audio settings next time (after changing them, or its address). */
export function forgetAudio(...deviceIds: string[]) {
  for (const id of deviceIds) audioCache.delete(id);
}

async function audioFor(d: Device, info: Awaited<ReturnType<typeof getInfo>>): Promise<AudioMode> {
  const hit = audioCache.get(d.id);
  if (hit && Date.now() - hit.at < AUDIO_TTL_MS) return hit.mode;
  const mode = await getAudio(d.host, info, STATUS_TIMEOUT_MS);
  audioCache.set(d.id, { mode, at: Date.now() });
  return mode;
}

async function fetchLive(d: Device): Promise<Live> {
  let live: Live;
  try {
    const [state, info] = await Promise.all([getState(d.host, STATUS_TIMEOUT_MS), getInfo(d.host, STATUS_TIMEOUT_MS)]);
    await syncLedCount(d, info.ledCount);
    live = { online: true, power: state.on, audio: await audioFor(d, info) };
  } catch {
    live = { online: false };
  }
  lastLive.set(d.id, live);
  return live;
}

/** Fresh status if the controller answers quickly; otherwise what we knew last (one check at a time). */
async function liveFor(d: Device): Promise<Live> {
  let check = inflight.get(d.id);
  if (!check) {
    check = fetchLive(d).finally(() => inflight.delete(d.id));
    inflight.set(d.id, check);
  }
  const quick = await Promise.race([check, new Promise<undefined>((r) => setTimeout(r, QUICK_MS))]);
  return quick ?? lastLive.get(d.id) ?? { online: false };
}

export async function withStatus(d: Device): Promise<Device & { status: DeviceStatus }> {
  const live = await liveFor(d);
  const current = store.device(d.id) ?? d; // the LED count may have just been updated
  return {
    ...current,
    brightness: player.deviceBrightness(current),
    status: { ...live, playing: player.playing(d.id), error: player.errorFor(d.id) },
  };
}

/** Keep LED counts current even when nobody has the app open. */
export function startLedSync() {
  setInterval(() => {
    for (const d of store.devices()) getInfo(d.host, 3000).then((i) => syncLedCount(d, i.ledCount), () => {});
  }, LED_SYNC_INTERVAL_MS).unref();
}

export class AudioSetupError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** Have `target` react to sound from `sourceId`'s microphone, or stop (null). */
export async function setAudioSource(target: Device, sourceId: string | null): Promise<AudioMode> {
  try {
    if (sourceId) {
      const source = store.device(sourceId);
      if (!source) throw new AudioSetupError('Device not found', 404);
      if ((await getAudio(source.host)) !== 'mic') throw new AudioSetupError(`${source.name} has no microphone`, 400);
      await linkAudio(source.host, target.host);
      forgetAudio(source.id, target.id);
      store.updateDevice(target.id, { audioSource: source.id });
    } else {
      // Only stop the source sharing when no other light is still listening to it.
      const source = store.device(target.audioSource ?? '');
      const stillUsed = source && store.devices().some((d) => d.id !== target.id && d.audioSource === source.id);
      await unlinkAudio(target.host, source && !stillUsed ? source.host : undefined);
      forgetAudio(target.id, ...(source ? [source.id] : []));
      store.updateDevice(target.id, { audioSource: undefined });
    }
    return await getAudio(target.host);
  } catch (e) {
    if (e instanceof AudioSetupError) throw e;
    throw new AudioSetupError(`Couldn’t update ${target.name}: ${(e as Error).message}`, 502);
  }
}
