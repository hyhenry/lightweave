import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, isStatic, isWledEffect, render, reverseFrame, rgbToHex, toWledRanges } from '../../shared/engine.ts';
import type { Pattern } from '../../shared/types.ts';

const pattern = (over: Partial<Pattern> = {}): Pattern => ({
  id: 'p',
  name: 'P',
  category: 'Test',
  blocks: [
    { color: '#FF0000', count: 2 },
    { color: '#0000FF', count: 1 },
  ],
  animation: 'static',
  speed: 5,
  direction: 'forward',
  brightness: 100,
  blend: false,
  ...over,
});
const pixel = (f: Uint8Array, i: number) => rgbToHex([f[i * 3], f[i * 3 + 1], f[i * 3 + 2]]);

test('hex conversions', () => {
  assert.deepEqual(hexToRgb('#ff8000'), [255, 128, 0]);
  assert.deepEqual(hexToRgb('#f80'), [255, 136, 0]);
  assert.equal(rgbToHex([255, 128, 0]), 'FF8000');
});

test('still patterns repeat their blocks along the strip', () => {
  const f = render(pattern(), 6, 0);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => pixel(f, i)), ['FF0000', 'FF0000', '0000FF', 'FF0000', 'FF0000', '0000FF']);
});

test('brightness scales output, unless the caller applies it elsewhere', () => {
  assert.equal(pixel(render(pattern({ brightness: 50 }), 1, 0), 0), '800000');
  assert.equal(pixel(render(pattern({ brightness: 50 }), 1, 0, undefined, false), 0), 'FF0000');
});

test('chase moves over time; reverse moves the other way', () => {
  const p = pattern({ animation: 'chase', speed: 10 });
  assert.notDeepEqual(render(p, 6, 0), render(p, 6, 0.5));
  const fwd = render(p, 6, 0.5);
  const rev = render({ ...p, direction: 'reverse' }, 6, 0.5);
  assert.notDeepEqual(fwd, rev);
});

test('rendering is deterministic (preview and lights agree)', () => {
  for (const animation of ['twinkle', 'sparkle', 'sound'] as const) {
    const p = pattern({ animation, sound: 'splash' });
    assert.deepEqual(render(p, 50, 3.21), render(p, 50, 3.21), animation);
  }
});

test('pattern kinds', () => {
  assert.equal(isStatic(pattern()), true);
  assert.equal(isStatic(pattern({ animation: 'chase' })), false);
  assert.equal(isWledEffect(pattern({ animation: 'sound' })), true);
});

test('toWledRanges merges runs and splits into chunks', () => {
  const f = render(pattern(), 6, 0);
  assert.deepEqual(toWledRanges(f, 6), [[0, 2, 'FF0000', 2, 3, '0000FF', 3, 5, 'FF0000', 5, 6, '0000FF']]);
  const chunks = toWledRanges(f, 6, 2);
  assert.equal(chunks.length, 2);
  assert.deepEqual(chunks.flat(), toWledRanges(f, 6)[0]);
});

test('reverseFrame flips pixel order', () => {
  const f = render(pattern(), 3, 0);
  assert.deepEqual([0, 1, 2].map((i) => pixel(reverseFrame(f, 3), i)), ['0000FF', 'FF0000', 'FF0000']);
});
