// Sound reactivity (WLED's AudioReactive usermod): whether a controller can hear
// music, and passing sound from one with a microphone to one without (UDP Sound Sync).

import type { AudioMode } from '../../shared/types.ts';
import { getInfo, request, setState, type WledInfo } from './client.ts';

interface AudioConfig {
  enabled?: boolean;
  sync?: { port?: number; mode?: number }; // mode is a bit field: 1 = send, 2 = receive
  // Mic settings only exist on ESP32 builds; -1 means "no pin".
  digitalmic?: { type?: number; pin?: number[] };
  analogmic?: { pin?: number };
}

const SYNC_SEND = 1;
const SYNC_RECEIVE = 2;
const DEFAULT_SYNC_PORT = 11988;

/** A microphone is wired up when the mic settings point at real pins. */
function hasMic(ar: AudioConfig) {
  const pins = [...(ar.digitalmic?.pin?.slice(0, 1) ?? []), ar.analogmic?.pin ?? -1];
  return pins.some((p) => p >= 0);
}

async function getAudioConfig(host: string, timeoutMs?: number): Promise<AudioConfig | undefined> {
  const cfg = await request(host, '/json/cfg', undefined, timeoutMs);
  return cfg.um?.AudioReactive;
}

function setAudioConfig(host: string, patch: AudioConfig) {
  return request(host, '/json/cfg', { um: { AudioReactive: patch } });
}

/**
 * How this controller hears music (see AudioMode), from its saved settings rather
 * than WLED's status text, which changes wording with the sync state.
 */
export async function getAudio(host: string, info?: WledInfo, timeoutMs?: number): Promise<AudioMode> {
  const { audio } = info ?? (await getInfo(host, timeoutMs));
  if (audio === 'none') return 'none';
  const ar = await getAudioConfig(host, timeoutMs).catch(() => undefined);
  if (!ar) return 'none';
  if (ar.enabled && (ar.sync?.mode ?? 0) & SYNC_RECEIVE) return 'receiving';
  return ar.enabled && hasMic(ar) ? 'mic' : 'capable';
}

export const canHear = (mode: AudioMode) => mode === 'mic' || mode === 'receiving';

/**
 * Pass sound from a controller with a microphone to one without. Saving settings
 * this way doesn't reboot WLED; the usermod connects within ~15 seconds.
 */
export async function linkAudio(sourceHost: string, targetHost: string) {
  const src = (await getAudioConfig(sourceHost)) ?? {};
  const port = src.sync?.port || DEFAULT_SYNC_PORT;
  await setAudioConfig(sourceHost, { sync: { port, mode: (src.sync?.mode ?? 0) | SYNC_SEND } });
  await setAudioConfig(targetHost, { enabled: true, sync: { port, mode: SYNC_RECEIVE } });
  await setState(targetHost, { AudioReactive: { enabled: true } });
}

/**
 * Undo linkAudio: the target stops listening (and AudioReactive is switched off if it
 * has no mic of its own); the source stops sharing when `sourceHost` is given.
 */
export async function unlinkAudio(targetHost: string, sourceHost?: string) {
  const cfg = (await getAudioConfig(targetHost)) ?? {};
  const keepOn = hasMic(cfg);
  await setAudioConfig(targetHost, { enabled: keepOn, sync: { mode: (cfg.sync?.mode ?? 0) & ~SYNC_RECEIVE } });
  if (!keepOn) await setState(targetHost, { AudioReactive: { enabled: false } });
  if (sourceHost) {
    const src = (await getAudioConfig(sourceHost)) ?? {};
    await setAudioConfig(sourceHost, { sync: { mode: (src.sync?.mode ?? 0) & ~SYNC_SEND } });
  }
}
