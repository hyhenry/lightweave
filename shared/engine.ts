// Pattern renderer. Pure and dependency-free so the browser preview and the
// server's light output produce exactly the same frames.

import type { ColorBlock, Pattern } from './types.ts';

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  return ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase();
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const scale = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

/** Cheap deterministic hash -> [0,1). Keeps twinkles identical in preview and on the house. */
function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** True when the pattern never changes over time, so it can be sent once instead of streamed. */
export function isStatic(p: Pattern): boolean {
  return p.animation === 'static';
}

interface Layout {
  colors: RGB[];
  starts: number[];
  ends: number[];
  length: number;
}

function layout(blocks: ColorBlock[]): Layout {
  const valid = blocks.filter((b) => b.count > 0);
  const use = valid.length ? valid : [{ color: '#000000', count: 1 }];
  const colors: RGB[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  let pos = 0;
  for (const b of use) {
    colors.push(hexToRgb(b.color));
    starts.push(pos);
    pos += Math.round(b.count);
    ends.push(pos);
  }
  return { colors, starts, ends, length: pos };
}

/** Color of the repeating pattern at a (possibly fractional) position along the strip. */
function colorAt(l: Layout, pos: number, blend: boolean): RGB {
  const x = ((pos % l.length) + l.length) % l.length;
  let i = 0;
  while (i < l.ends.length - 1 && x >= l.ends[i]) i++;
  const c = l.colors[i];
  if (!blend || l.colors.length < 2) return c;
  // Blend toward the next block across the back half of this block.
  const len = l.ends[i] - l.starts[i];
  const t = (x - l.starts[i]) / len;
  if (t < 0.5) return c;
  const next = l.colors[(i + 1) % l.colors.length];
  return mix(c, next, (t - 0.5) * 2);
}

/** Speed 1..10 -> LEDs per second for moving animations. */
const pixelsPerSecond = (speed: number) => 1.5 * Math.pow(1.45, speed - 1);

/**
 * Render one frame.
 * @param t seconds since the animation started
 * @param out optional buffer to fill (ledCount * 3 bytes)
 * @param applyBrightness scale by pattern brightness (the server does this for streaming;
 *        static sends use WLED's own brightness instead)
 */
export function render(
  p: Pattern,
  ledCount: number,
  t: number,
  out: Uint8Array = new Uint8Array(ledCount * 3),
  applyBrightness = true,
): Uint8Array {
  const l = layout(p.blocks);
  const dir = p.direction === 'reverse' ? -1 : 1;
  const speed = Math.max(1, Math.min(10, p.speed));
  const bri = applyBrightness ? Math.max(0, Math.min(100, p.brightness)) / 100 : 1;

  for (let i = 0; i < ledCount; i++) {
    let c: RGB;
    switch (p.animation) {
      case 'chase': {
        const off = t * pixelsPerSecond(speed) * dir;
        const pos = i - off;
        if (p.blend) {
          c = colorAt(l, pos, true);
        } else {
          // Smooth sub-pixel motion with hard-edged blocks
          const f = pos - Math.floor(pos);
          c = mix(colorAt(l, Math.floor(pos), false), colorAt(l, Math.floor(pos) + 1, false), f);
        }
        break;
      }
      case 'marquee': {
        // Jumps one LED at a time like theater lights.
        const steps = Math.floor(t * pixelsPerSecond(speed) * 0.8);
        c = colorAt(l, i - steps * dir, p.blend);
        break;
      }
      case 'twinkle': {
        // Each LED fades in and out on its own random schedule.
        const base = colorAt(l, i, p.blend);
        const period = 6 / (0.4 + speed * 0.35);
        const phase = hash(i, 7) * period;
        const cycle = Math.floor((t + phase) / period);
        const local = ((t + phase) % period) / period;
        const lit = hash(i, cycle) < 0.55;
        const glow = lit ? Math.sin(local * Math.PI) : 0;
        c = scale(base, 0.08 + 0.92 * glow);
        break;
      }
      case 'sparkle': {
        // Steady pattern with brief white glints.
        const base = colorAt(l, i, p.blend);
        const rate = 4 + speed * 3; // glint slots per second
        const slot = Math.floor(t * rate);
        const f = t * rate - slot;
        const on = hash(i, slot) < 0.012 + speed * 0.002;
        c = on ? mix([255, 255, 255], base, f) : base;
        break;
      }
      case 'breathe': {
        const k = 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(t * (0.4 + speed * 0.25)));
        c = scale(colorAt(l, i, p.blend), k);
        break;
      }
      case 'wave': {
        // Pattern stays put while a band of brightness rolls along it.
        const wl = 24;
        const phase = (i / wl) * Math.PI * 2 - t * pixelsPerSecond(speed) * dir * ((Math.PI * 2) / wl);
        c = scale(colorAt(l, i, p.blend), 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(phase)));
        break;
      }
      case 'colorCycle': {
        // Whole strip fades through the pattern's colors, one at a time.
        const n = l.colors.length;
        const hold = 8 / (0.5 + speed * 0.6);
        const x = t / hold;
        const k = Math.floor(x);
        const f = Math.min(1, (x - k) * 2.5); // fade then hold
        const a = l.colors[(((k * dir) % n) + n) % n];
        const b = l.colors[((((k + 1) * dir) % n) + n) % n];
        c = mix(a, b, f);
        break;
      }
      default:
        c = colorAt(l, i, p.blend);
    }
    const o = i * 3;
    out[o] = Math.round(c[0] * bri);
    out[o + 1] = Math.round(c[1] * bri);
    out[o + 2] = Math.round(c[2] * bri);
  }
  return out;
}

/**
 * Compress a static frame into WLED's segment "i" range form:
 * [start, stop, "RRGGBB", ...] (stop exclusive), split into request-sized chunks.
 */
export function toWledRanges(frame: Uint8Array, ledCount: number, maxRangesPerChunk = 80): (number | string)[][] {
  const chunks: (number | string)[][] = [];
  let cur: (number | string)[] = [];
  let start = 0;
  const hexAt = (i: number) => rgbToHex([frame[i * 3], frame[i * 3 + 1], frame[i * 3 + 2]]);
  let prev = hexAt(0);
  for (let i = 1; i <= ledCount; i++) {
    const hex = i < ledCount ? hexAt(i) : '';
    if (hex !== prev) {
      cur.push(start, i, prev);
      if (cur.length / 3 >= maxRangesPerChunk) {
        chunks.push(cur);
        cur = [];
      }
      start = i;
      prev = hex;
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

export function reverseFrame(frame: Uint8Array, ledCount: number): Uint8Array {
  const out = new Uint8Array(frame.length);
  for (let i = 0; i < ledCount; i++) {
    const s = i * 3;
    const d = (ledCount - 1 - i) * 3;
    out[d] = frame[s];
    out[d + 1] = frame[s + 1];
    out[d + 2] = frame[s + 2];
  }
  return out;
}
