import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autopilotPattern, dueEvents, isRunning, nextEvents, runsOn, windowsAround } from '../../shared/schedule.ts';
import { BUILT_IN_THEMES } from '../../shared/themes.ts';
import type { Schedule } from '../../shared/types.ts';

const EDMONTON = { location: { name: 'Edmonton, AB', lat: 53.55, lon: -113.49 } };
const base: Schedule = {
  id: 's',
  name: 'Test',
  enabled: true,
  patternId: 'autopilot',
  deviceIds: [],
  on: { kind: 'time', time: '18:00' },
  days: [0, 1, 2, 3, 4, 5, 6],
};

test('an off time earlier than the on time ends the next morning', () => {
  const s: Schedule = { ...base, on: { kind: 'time', time: '19:00' }, off: { kind: 'time', time: '01:00' } };
  const at = new Date(2026, 9, 30, 0, 30); // 12:30 a.m. Friday
  const running = windowsAround(s, at, {}).find((w) => w.on! <= at && at < w.off!);
  assert.ok(running, 'Thursday evening’s run is still going after midnight');
  assert.equal(running.on!.getDate(), 29);
  assert.equal(running.off!.getDate(), 30);
});

test('sunset triggers use the location and offset', () => {
  const s: Schedule = { ...base, on: { kind: 'sunset', offset: -15 } };
  const { on } = nextEvents(s, new Date(2026, 11, 21, 9), EDMONTON);
  assert.equal(on!.getHours(), 16);
  assert.ok(Math.abs(on!.getMinutes() - 1) <= 4, `~4:01 p.m., got ${on!.toTimeString()}`);
  assert.equal(nextEvents(s, new Date(), {}).on, undefined, 'no location, no sunset');
});

test('days of the week and seasons that wrap past New Year', () => {
  const weekdays: Schedule = { ...base, days: [1, 2, 3, 4, 5] };
  assert.equal(runsOn(weekdays, new Date(2026, 9, 31)), false); // Saturday
  assert.equal(runsOn(weekdays, new Date(2026, 10, 2)), true); // Monday
  const xmas: Schedule = { ...base, season: { from: [12, 1], to: [1, 6] } };
  assert.equal(runsOn(xmas, new Date(2026, 10, 30)), false);
  assert.equal(runsOn(xmas, new Date(2026, 11, 1)), true);
  assert.equal(runsOn(xmas, new Date(2027, 0, 6)), true);
  assert.equal(runsOn(xmas, new Date(2027, 0, 7)), false);
});

test('holiday autopilot', () => {
  const pick = (d: Date, favs: string[] = []) => autopilotPattern(BUILT_IN_THEMES, favs, d)?.name;
  assert.equal(pick(new Date(2026, 9, 29)), 'Pumpkin Patch', 'first Halloween theme');
  assert.equal(pick(new Date(2026, 9, 29), ['builtin-halloween-witchy']), 'Witchy', 'a favorite wins');
  assert.equal(pick(new Date(2026, 10, 26)), 'Classic Red & Green', 'Hanukkah only if favorited');
  assert.equal(pick(new Date(2026, 10, 26), ['builtin-hanukkah-menorah-light']), 'Menorah Light');
  assert.equal(pick(new Date(2027, 1, 10)), 'Sweetheart');
  assert.equal(pick(new Date(2027, 6, 20)), 'Warm White', 'warm white when no holiday is near');
});

test('dueEvents fires each event exactly once across ticks', () => {
  const s: Schedule = { ...base, on: { kind: 'time', time: '18:00' }, off: { kind: 'time', time: '23:00' } };
  const at = (h: number, m = 0) => new Date(2026, 9, 29, h, m);
  assert.deepEqual(dueEvents([s], {}, at(17, 59), at(18, 0)).map((e) => e.kind), ['on']);
  assert.deepEqual(dueEvents([s], {}, at(18, 0), at(18, 1)), [], 'not again on the next tick');
  assert.deepEqual(dueEvents([s], {}, at(17), at(23, 30)).map((e) => e.kind), ['on', 'off'], 'in time order after a long gap');
  assert.deepEqual(dueEvents([{ ...s, enabled: false }], {}, at(17), at(23, 30)), [], 'paused schedules never fire');
});

test('isRunning covers runs that started yesterday', () => {
  const s: Schedule = { ...base, on: { kind: 'time', time: '19:00' }, off: { kind: 'time', time: '01:00' } };
  assert.equal(isRunning(s, {}, new Date(2026, 9, 30, 0, 30)), true);
  assert.equal(isRunning(s, {}, new Date(2026, 9, 30, 1, 30)), false);
});
