// Putting something on the lights through the JSON API: per-LED still patterns,
// or one of WLED's own effects (used for sound-reactive patterns).

import { rgbToHex, type RGB } from '../../shared/engine.ts';
import { readFile, request, setState, toWledBri, uploadFile } from './client.ts';

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

// Lightweave keeps one custom palette on each controller for patterns with 2–3
// colors. WLED's own color palettes all include color 2, which is also the color
// effects fade to, so with those the strip never goes dark between sounds.
// The marker tells our palette file apart from ones people made themselves.
const MARKER = 'lightweave';

interface PaletteSlot {
  file: string;
  id: number;
  saved?: string; // file contents last saved, so unchanged colors don't rewrite flash
}

const paletteSlots = new Map<string, PaletteSlot | null>(); // null: no free slot
const paletteQueue = new Map<string, Promise<unknown>>();

/** Our palette slot: the first file that's ours or missing. */
async function findSlot(host: string): Promise<PaletteSlot | null> {
  const info = await request(host, '/json/info');
  const count: number = info.cpalcount ?? 0;
  const max: number = info.cpalmax ?? 10;
  for (let i = 0; i <= count && i < max; i++) {
    const file = `palette${i}.json`;
    const data = (await readFile(host, file)) as Record<string, unknown> | undefined;
    if (data && !data[MARKER]) continue;
    // WLED 16 numbers custom palettes down from 200 (it reports usermod palettes);
    // older versions count down from 255.
    const id = ('umpalcount' in info ? 200 : 255) - i;
    return { file, id, saved: data ? JSON.stringify(data) : undefined };
  }
  return null;
}

/** Save a gradient through the colors (and back to the first, so it loops) as our palette. */
async function customPalette(host: string, colors: RGB[]): Promise<number | undefined> {
  let slot = paletteSlots.get(host);
  if (slot === undefined) {
    slot = await findSlot(host);
    paletteSlots.set(host, slot);
  }
  if (!slot) return undefined;
  const stops = [...colors, colors[0]];
  const palette = stops.flatMap((c, i) => [Math.round((i / (stops.length - 1)) * 255), rgbToHex(c)]);
  const content = JSON.stringify({ palette, [MARKER]: true });
  if (slot.saved !== content) {
    await uploadFile(host, slot.file, content);
    slot.saved = content;
  }
  return slot.id;
}

/** Palette following the pattern's colors; falls back to the first color only. */
function colorPalette(host: string, colors: RGB[]): Promise<number> {
  const run = async () => {
    if (colors.length > 1) {
      const id = await customPalette(host, colors).catch((e) => {
        // e.g. a settings PIN blocks uploads. Look again next time.
        console.warn(`[wled] ${host}: couldn't save a color palette (${(e as Error).message})`);
        paletteSlots.delete(host);
        return undefined;
      });
      if (id !== undefined) return id;
    }
    return indexOf(host, 'palettes', '* Color 1');
  };
  // One at a time per controller, so quick color changes don't write over each other.
  const next = (paletteQueue.get(host) ?? Promise.resolve()).then(run, run);
  paletteQueue.set(host, next.catch(() => {}));
  return next;
}

export interface EffectOptions {
  effect: string;
  colors: RGB[];
  ownColors?: boolean; // the effect picks its own colors
  speed: number; // 0–255
  brightness: number; // percent
  params: Record<string, number | boolean>;
}

/** Run one of WLED's own effects on segment 0 with our colors, on a black background. */
export async function sendEffect(host: string, opts: EffectOptions) {
  const fx = await indexOf(host, 'effects', opts.effect);
  const pal = opts.ownColors ? undefined : await colorPalette(host, opts.colors);
  await setState(host, {
    live: false,
    on: true,
    bri: toWledBri(opts.brightness),
    seg: { id: 0, frz: false, fx, sx: opts.speed, ...(pal !== undefined && { pal }), col: [opts.colors[0], [0, 0, 0], [0, 0, 0]], ...opts.params },
  });
}
