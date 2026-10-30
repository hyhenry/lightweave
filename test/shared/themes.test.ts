import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_THEMES } from '../../shared/themes.ts';
import { SOUND_EFFECT_IDS } from '../../shared/sound.ts';
import { ANIMATIONS } from '../../shared/types.ts';

test('theme IDs that favorites and schedules point at stay stable', () => {
  const ids = new Set(BUILT_IN_THEMES.map((p) => p.id));
  for (const id of [
    'builtin-everyday-warm-white', // autopilot fallback
    'builtin-celebrations-pride', // Celebrations merged into "Everyday & Celebrations"
    'builtin-halloween-pumpkin-patch',
    'builtin-christmas-candy-cane',
    'builtin-sound-reactive-neon-pulse',
  ])
    assert.ok(ids.has(id), id);
});

test('every theme is well-formed and IDs are unique', () => {
  const seen = new Set<string>();
  for (const p of BUILT_IN_THEMES) {
    assert.ok(!seen.has(p.id), `duplicate ${p.id}`);
    seen.add(p.id);
    assert.ok(p.blocks.length > 0, p.name);
    assert.ok(p.blocks.every((b) => /^#[0-9A-F]{6}$/.test(b.color) && b.count > 0), p.name);
    assert.ok(ANIMATIONS.includes(p.animation), p.name);
    if (p.animation === 'sound') assert.ok(SOUND_EFFECT_IDS.includes(p.sound!), p.name);
  }
});
