import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA_VERSION, migrate } from '../../server/migrate.ts';
import type { Data } from '../../server/store.ts';
import { BUILT_IN_THEMES } from '../../shared/themes.ts';

const empty = (): Data => ({ devices: [], patterns: [], favorites: [], active: {}, off: [], schedules: [], settings: {} });

test('v1 → v2 moves the slider brightness onto the device', () => {
  const witchy = BUILT_IN_THEMES.find((p) => p.id === 'builtin-halloween-witchy')!;
  const data = empty();
  data.devices.push({ id: 'd', name: 'Roof', host: 'x', ledCount: 10, reverse: false });
  data.active.d = { ...witchy, brightness: 40 };
  assert.equal(migrate(data, BUILT_IN_THEMES), true);
  assert.equal(data.devices[0].brightness, 40);
  assert.equal(data.active.d.brightness, witchy.brightness);
  assert.equal(data.version, DATA_VERSION);
});

test('current data is left alone', () => {
  const data = { ...empty(), version: DATA_VERSION };
  data.patterns.push({ ...BUILT_IN_THEMES[0], id: 'mine', builtIn: false, brightness: 80 });
  assert.equal(migrate(data, BUILT_IN_THEMES), false);
  assert.equal(data.patterns[0].brightness, 80, 'a deliberate 80% stays 80%');
});
