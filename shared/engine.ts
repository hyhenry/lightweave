// Pattern renderer. Pure and dependency-free so the browser preview and the
// server's light output produce exactly the same frames.

import type { ColorBlock, Pattern } from './types.ts';
import { soundEffect, type SoundPreview } from './sound.ts';

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

/** Sound patterns run as WLED's own effect, since only the controller can hear the music. */
export function isWledEffect(p: Pattern): boolean {
  return p.animation === 'sound';
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
      case 'sound': {
        c = soundPixel(soundEffect(p.sound).preview, l, i, ledCount, t);
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

// ---- Sound preview -------------------------------------------------------
// The app can't hear the room, so previews dance to a made-up ~120bpm beat.

function soundLevel(t: number): number {
  const beat = t * 2;
  const k = Math.floor(beat);
  const hit = 0.55 + 0.45 * hash(k, 99);
  const env = Math.exp(-(beat - k) * 4) * hit;
  const wobble = 0.15 * (0.5 + 0.5 * Math.sin(t * 7.3)) * (0.5 + 0.5 * Math.sin(t * 2.1));
  return Math.min(1, env * 0.85 + wobble);
}

/** Smooth gradient through the pattern's first three colors, x in 0..1. */
function gradient(l: Layout, x: number): RGB {
  const cols = l.colors.slice(0, 3);
  if (cols.length === 1) return cols[0];
  const pos = Math.max(0, Math.min(1, x)) * (cols.length - 1);
  const k = Math.min(cols.length - 2, Math.floor(pos));
  return mix(cols[k], cols[k + 1], pos - k);
}

function hsv(h: number, s = 1, v = 1): RGB {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}

function soundPixel(style: SoundPreview, l: Layout, i: number, n: number, t: number): RGB {
  const level = soundLevel(t);
  const x = i / Math.max(1, n - 1);
  const d = Math.abs(i - (n - 1) / 2) / Math.max(1, (n - 1) / 2); // 0 at center, 1 at ends
  const off: RGB = [0, 0, 0];
  switch (style) {
    case 'meter': {
      const peak = Math.max(level, soundLevel(t - 0.3) * 0.9, soundLevel(t - 0.6) * 0.8);
      if (Math.abs(x - peak) < 1.2 / n) return [255, 255, 255];
      return x <= level ? gradient(l, x) : off;
    }
    case 'centerMeter': {
      const peak = Math.max(level, soundLevel(t - 0.3) * 0.9, soundLevel(t - 0.6) * 0.8);
      if (Math.abs(d - peak) < 2 / n) return gradient(l, 1);
      return d <= level ? gradient(l, d) : off;
    }
    case 'pulse': {
      // Each LED shows the level from a moment ago, so beats travel outward.
      return scale(gradient(l, d), soundLevel(t - d * 0.6) ** 1.5);
    }
    case 'glow':
      return scale(gradient(l, d), Math.max(0, Math.min(1, (level * 1.2 - d) * 3)));
    case 'splash': {
      let out = off;
      const beat = t * 2;
      for (let k = Math.floor(beat) - 2; k <= Math.floor(beat); k++) {
        const age = beat - k;
        const center = hash(k, 1) * n;
        const width = 2 + hash(k, 3) * 5 + age * 3;
        if (Math.abs(i - center) < width) out = scale(gradient(l, hash(k, 2)), Math.exp(-age * 1.6) * (0.5 + 0.5 * hash(k, 99)));
      }
      return out;
    }
    case 'confetti': {
      const slot = Math.floor(t * 9);
      let out = off;
      for (let k = slot - 4; k <= slot; k++) {
        const pos = hash(k, 5) * n;
        const dist = Math.abs(i - pos);
        if (dist < 2.5) out = scale(gradient(l, hash(k, 6)), (1 - dist / 2.5) * Math.exp(-(t * 9 - k) * 0.6) * (0.3 + soundLevel(k / 9)));
      }
      return out;
    }
    case 'juggle': {
      let best = 0;
      let col = off;
      for (let k = 0; k < 4; k++) {
        const pos = (0.5 + 0.5 * Math.sin(t * (0.7 + k * 0.23) + k * 1.7)) * (n - 1);
        const b = Math.max(0, 1 - Math.abs(i - pos) / 3) * (0.35 + 0.65 * level);
        if (b > best) {
          best = b;
          col = scale(gradient(l, k / 3), b);
        }
      }
      return col;
    }
    case 'rainbow':
      return scale(hsv((d * 0.5 + t * 0.08) % 1), Math.max(0.05, soundLevel(t - d * 0.4)));
    case 'fire': {
      const heat = Math.max(0, Math.min(1, level * 1.3 - x * 0.7 + (hash(i, Math.floor(t * 12)) - 0.5) * 0.3));
      return heat < 0.33 ? scale([255, 0, 0], heat * 3) : heat < 0.66 ? mix([255, 0, 0], [255, 120, 0], (heat - 0.33) * 3) : mix([255, 120, 0], [255, 220, 80], (heat - 0.66) * 3);
    }
  }
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
