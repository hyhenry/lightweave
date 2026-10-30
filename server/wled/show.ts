// Putting something on the lights through the JSON API: per-LED still patterns,
// or one of WLED's own effects (used for sound-reactive patterns).

import { request, setState, toWledBri } from './client.ts';

/**
 * Show a still pattern using per-LED control on segment 0. Chunks are sent one
 * after another (never in parallel) since ESP JSON buffers are small.
 */
export async function sendStatic(host: string, chunks: (number | string)[][], brightness: number) {
  // Leave realtime mode in case we were streaming to this device.
  await setState(host, { live: false });
  for (let i = 0; i < chunks.length; i++) {
    const seg = i === 0 ? { id: 0, fx: 0, i: chunks[i] } : { id: 0, i: chunks[i] };
    await setState(host, i === 0 ? { on: true, bri: toWledBri(brightness), seg } : { seg });
  }
}

const listCache = new Map<string, string[]>();

/** Position of a named effect or palette on this controller (numbers vary by WLED version). */
async function indexOf(host: string, list: 'effects' | 'palettes', name: string): Promise<number> {
  const key = `${host}|${list}`;
  let names = listCache.get(key);
  if (!names) {
    names = (await request(host, `/json/${list}`)) as string[];
    listCache.set(key, names);
  }
  const i = names.indexOf(name);
  if (i === -1) {
    listCache.delete(key);
    throw new Error(`this WLED doesn't have the “${name}” ${list === 'effects' ? 'effect' : 'palette'}`);
  }
  return i;
}

export interface EffectOptions {
  effect: string;
  palette?: string;
  colors: [number, number, number][];
  speed: number; // 0–255
  brightness: number; // percent
  params?: Record<string, number>;
}

/** Run one of WLED's own effects on segment 0 with our colors. */
export async function sendEffect(host: string, opts: EffectOptions) {
  const fx = await indexOf(host, 'effects', opts.effect);
  const pal = opts.palette ? await indexOf(host, 'palettes', opts.palette) : undefined;
  await setState(host, {
    live: false,
    on: true,
    bri: toWledBri(opts.brightness),
    seg: { id: 0, frz: false, fx, sx: opts.speed, ...(pal !== undefined && { pal }), col: opts.colors, ...opts.params },
  });
}
