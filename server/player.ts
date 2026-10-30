// Playback manager: decides per device whether a pattern is sent once (static)
// or streamed as frames (animated), and keeps streams running.

import type { Device, DeviceStatus, Pattern } from '../shared/types.ts';
import { isStatic, render, reverseFrame, toWledRanges } from '../shared/engine.ts';
import { hostOnly, sendDdpFrame, sendStatic, setState } from './wled.ts';
import { store } from './store.ts';

const FPS = 30;

interface Stream {
  timer: NodeJS.Timeout;
  pattern: Pattern;
}

const streams = new Map<string, Stream>();
const lastError = new Map<string, string>();

function stopStream(deviceId: string) {
  const s = streams.get(deviceId);
  if (s) clearInterval(s.timer);
  streams.delete(deviceId);
}

function startStream(device: Device, pattern: Pattern, epoch: number) {
  stopStream(device.id);
  const host = hostOnly(device.host);
  const buf = new Uint8Array(device.ledCount * 3);
  const timer = setInterval(() => {
    try {
      const frame = render(pattern, device.ledCount, (Date.now() - epoch) / 1000, buf);
      sendDdpFrame(host, device.reverse ? reverseFrame(frame, device.ledCount) : frame);
    } catch (e) {
      lastError.set(device.id, (e as Error).message);
    }
  }, 1000 / FPS);
  streams.set(device.id, { timer, pattern });
}

/** Show a pattern on the given devices. Devices started together stay in sync. */
export async function play(pattern: Pattern, devices: Device[]) {
  const epoch = Date.now();
  const results = await Promise.all(
    devices.map(async (device) => {
      try {
        if (isStatic(pattern)) {
          stopStream(device.id);
          let frame = render(pattern, device.ledCount, 0, undefined, false);
          if (device.reverse) frame = reverseFrame(frame, device.ledCount);
          await sendStatic(device.host, toWledRanges(frame, device.ledCount), pattern.brightness);
        } else {
          // Make sure the strip is powered on; DDP data alone won't turn it on.
          await setState(device.host, { on: true, bri: 255 });
          startStream(device, pattern, epoch);
        }
        store.setActive(device.id, pattern);
        lastError.delete(device.id);
        return { deviceId: device.id, ok: true };
      } catch (e) {
        const msg = `Couldn't reach ${device.name}: ${(e as Error).message}`;
        lastError.set(device.id, msg);
        return { deviceId: device.id, ok: false, error: msg };
      }
    }),
  );
  return results;
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

export function playing(deviceId: string): DeviceStatus['playing'] {
  const p = store.active()[deviceId];
  if (!p || store.isOff(deviceId)) return undefined;
  return { patternId: p.id, patternName: p.name, mode: streams.has(deviceId) ? 'stream' : 'static' };
}

export function errorFor(deviceId: string) {
  return lastError.get(deviceId);
}

/** Pick animated patterns back up after the server restarts (still ones are already on WLED). */
export async function resume() {
  for (const [deviceId, pattern] of Object.entries(store.active())) {
    const device = store.device(deviceId);
    if (device && !isStatic(pattern) && !store.isOff(deviceId)) await play(pattern, [device]);
  }
}
