// Playback: decides per device whether a pattern is sent once (still), streamed
// as frames (animated) or run as WLED's own effect (sound), and keeps streams going.

import type { Device, DeviceStatus, Pattern } from '../shared/types.ts';
import { hexToRgb, isStatic, isWledEffect, render, reverseFrame, toWledRanges } from '../shared/engine.ts';
import { DEFAULT_PARAMS, effectSpeed, soundEffect } from '../shared/sound.ts';
import { hostOnly, setState, toWledBri } from './wled/client.ts';
import { sendEffect, sendStatic } from './wled/show.ts';
import { sendDdpFrame } from './wled/ddp.ts';
import { canHear, getAudio } from './wled/audio.ts';
import { store } from './store.ts';

const FPS = 30;
const DEFAULT_BRIGHTNESS = 80;

export interface Result {
  deviceId: string;
  ok: boolean;
  error?: string;
}

interface Stream {
  timer: NodeJS.Timeout;
  pattern: Pattern; // read every frame, so brightness changes apply immediately
}

const streams = new Map<string, Stream>();
const lastError = new Map<string, string>();

function stopStream(deviceId: string) {
  clearInterval(streams.get(deviceId)?.timer);
  streams.delete(deviceId);
}

function startStream(device: Device, pattern: Pattern, epoch: number) {
  stopStream(device.id);
  const host = hostOnly(device.host);
  const buf = new Uint8Array(device.ledCount * 3);
  const stream: Stream = { pattern, timer: setInterval(() => sendFrame(), 1000 / FPS) };
  function sendFrame() {
    try {
      const frame = render(stream.pattern, device.ledCount, (Date.now() - epoch) / 1000, buf);
      sendDdpFrame(host, device.reverse ? reverseFrame(frame, device.ledCount) : frame);
    } catch (e) {
      lastError.set(device.id, (e as Error).message);
    }
  }
  streams.set(device.id, stream);
}

/** The controller's own brightness (the "Now showing" slider), which carries over between patterns. */
export function deviceBrightness(device: Device) {
  return device.brightness ?? DEFAULT_BRIGHTNESS;
}

/** A pattern's own brightness is relative, so softer themes stay softer at any light level. */
function effective(pattern: Pattern, device: Device): Pattern {
  return { ...pattern, brightness: (pattern.brightness * deviceBrightness(device)) / 100 };
}

async function sendSound(device: Device, p: Pattern) {
  const fx = soundEffect(p.sound);
  await sendEffect(device.host, {
    effect: fx.wled,
    colors: p.blocks.slice(0, 3).map((b) => hexToRgb(b.color)),
    ownColors: !fx.usesColors,
    speed: effectSpeed(fx, p.speed),
    brightness: p.brightness,
    params: { ...DEFAULT_PARAMS, ...fx.params },
  });
}

async function show(device: Device, pattern: Pattern, epoch: number) {
  const shown = effective(pattern, device);
  if (isWledEffect(pattern)) {
    stopStream(device.id);
    await sendSound(device, shown);
  } else if (isStatic(pattern)) {
    stopStream(device.id);
    let frame = render(pattern, device.ledCount, 0, undefined, false);
    if (device.reverse) frame = reverseFrame(frame, device.ledCount);
    await sendStatic(device.host, toWledRanges(frame, device.ledCount), shown.brightness);
  } else {
    // DDP data alone won't power the strip on; brightness is applied in the frames.
    await setState(device.host, { on: true, bri: 255 });
    startStream(device, shown, epoch);
  }
}

/** Why a sound pattern can't play on this device, if it can't. */
async function cantHear(device: Device): Promise<string | undefined> {
  const audio = await getAudio(device.host, undefined, 2000).catch(() => 'none' as const);
  if (canHear(audio)) return undefined;
  return audio === 'capable' || audio === 'mic-off' ? `${device.name} isn’t audio reactive yet. Turn it on in Lights.` : `${device.name} isn’t audio reactive.`;
}

/** Show a pattern on the given devices. Devices started together stay in sync. */
export async function play(pattern: Pattern, devices: Device[]): Promise<Result[]> {
  const epoch = Date.now();
  return Promise.all(
    devices.map(async (device): Promise<Result> => {
      const refused = isWledEffect(pattern) ? await cantHear(device) : undefined;
      if (refused) return { deviceId: device.id, ok: false, error: refused };
      try {
        await show(device, pattern, epoch);
        store.setActive(device.id, pattern);
        lastError.delete(device.id);
        return { deviceId: device.id, ok: true };
      } catch (e) {
        const error = `Couldn't reach ${device.name}: ${(e as Error).message}`;
        lastError.set(device.id, error);
        return { deviceId: device.id, ok: false, error };
      }
    }),
  );
}

/** Stop anything Lightweave is doing and hand the lights back to WLED. */
export async function release(device: Device) {
  stopStream(device.id);
  store.setActive(device.id, undefined);
  await setState(device.host, { live: false });
}

/** Turning off keeps the current pattern so turning back on brings it back. */
export async function power(device: Device, on: boolean) {
  const active = store.active()[device.id];
  if (!on) {
    stopStream(device.id);
    if (active) store.setOff(device.id, true);
    await setState(device.host, { live: false, on: false });
  } else if (active) {
    await play(active, [device]);
  } else {
    await setState(device.host, { on: true });
  }
}

export function forget(deviceId: string) {
  stopStream(deviceId);
  lastError.delete(deviceId);
}

/** Re-send the current pattern after a device's settings (LED count, direction…) change. */
export async function refresh(device: Device) {
  forget(device.id);
  const active = store.active()[device.id];
  if (active && !store.isOff(device.id)) await play(active, [device]);
}

/** Set the controller's brightness; it applies right away and to every pattern shown after. */
export async function setBrightness(device: Device, brightness: number) {
  const updated = store.updateDevice(device.id, { brightness }) ?? device;
  if (store.isOff(device.id)) return;
  const active = store.active()[device.id];
  // Not showing a Lightweave pattern: just dim whatever WLED is doing.
  if (!active) return void (await setState(device.host, { bri: toWledBri(brightness) }));
  const shown = effective(active, updated);
  const stream = streams.get(device.id);
  if (stream) stream.pattern = shown;
  else await setState(device.host, { bri: toWledBri(shown.brightness) });
}

export function playing(deviceId: string): DeviceStatus['playing'] {
  const p = store.active()[deviceId];
  if (!p || store.isOff(deviceId)) return undefined;
  const mode = streams.has(deviceId) ? 'stream' : isWledEffect(p) ? 'wled' : 'static';
  return { patternId: p.id, patternName: p.name, mode, pattern: p };
}

export function errorFor(deviceId: string) {
  return lastError.get(deviceId);
}

/** Pick streamed animations back up after a restart (still and sound ones are already on WLED). */
export async function resume() {
  for (const [deviceId, pattern] of Object.entries(store.active())) {
    const device = store.device(deviceId);
    if (device && !isStatic(pattern) && !isWledEffect(pattern) && !store.isOff(deviceId)) await play(pattern, [device]);
  }
}
