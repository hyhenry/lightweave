// The web app's pure helpers (no browser needed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clock, daysLabel, holidayWhenLabel, hostLabel, nextRunLabel, offsetLabel, triggerLabel } from '../../web/src/lib/format.ts';
import { groupCategories } from '../../web/src/lib/gallery.ts';
import { editableCopy, motionLabel, newPattern } from '../../web/src/lib/patterns.ts';
import { newSchedule, patternChoices, scheduleSummary, showingLabel, usesSun } from '../../web/src/lib/schedules.ts';
import { BUILT_IN_THEMES } from '../../shared/themes.ts';
import type { Schedule } from '../../shared/types.ts';

test('time and offset labels', () => {
  assert.match(clock('18:30'), /6:30/);
  assert.equal(offsetLabel(0, 'sunset'), 'At sunset');
  assert.equal(offsetLabel(-30, 'sunset'), '30 min before sunset');
  assert.equal(offsetLabel(90, 'sunrise'), '1 hr 30 min after sunrise');
  assert.equal(offsetLabel(120, 'sunset'), '2 hr after sunset');
  assert.equal(triggerLabel({ kind: 'sunset', offset: 0 }), 'Sunset');
  assert.equal(triggerLabel({ kind: 'sunset', offset: -15 }), '15 min before sunset');
});

test('day labels', () => {
  assert.equal(daysLabel([6, 0, 1, 2, 3, 4, 5]), 'Every day');
  assert.equal(daysLabel([5, 4, 3, 2, 1]), 'Weekdays');
  assert.equal(daysLabel([6, 0]), 'Weekends');
  assert.equal(daysLabel([5, 1, 3]), 'Mon, Wed, Fri');
});

test('next-run and holiday labels', () => {
  const now = new Date(2026, 9, 29, 12);
  assert.match(nextRunLabel(new Date(2026, 9, 29, 18).toISOString(), now)!, /^Today /);
  assert.match(nextRunLabel(new Date(2026, 9, 30, 18).toISOString(), now)!, /^Tomorrow /);
  assert.equal(nextRunLabel(undefined, now), undefined);
  assert.equal(holidayWhenLabel('Halloween', now), 'in 2 days');
  assert.equal(holidayWhenLabel('Halloween', new Date(2026, 9, 31)), 'Today');
  assert.equal(holidayWhenLabel('Everyday & Celebrations', now), undefined);
  assert.equal(hostLabel('http://192.168.2.20/'), '192.168.2.20');
});

test('Themes tab grouping', () => {
  const cats = [...new Set(BUILT_IN_THEMES.map((p) => p.category))];
  const g = groupCategories(cats, new Date(2026, 9, 29));
  assert.deepEqual(g.soon, ['Halloween', 'Remembrance Day', 'Hanukkah', 'Winter', 'Christmas']);
  assert.deepEqual(g.anytime, ['Everyday & Celebrations', 'Sound Reactive']);
  assert.equal(g.later[0], 'New Year’s Eve');
  assert.equal(g.soon.length + g.anytime.length + g.later.length, cats.length);
  // Nothing within 60 days: the next holiday is still "coming up".
  assert.deepEqual(groupCategories(['Canada Day', 'Thanksgiving'], new Date(2026, 9, 29)).soon, ['Canada Day']);
});

test('pattern helpers', () => {
  const witchy = BUILT_IN_THEMES.find((p) => p.id === 'builtin-halloween-witchy')!;
  const copy = editableCopy(witchy);
  assert.equal(copy.name, 'Witchy (mine)');
  assert.equal(copy.category, 'My Patterns');
  copy.blocks[0].color = '#000000';
  assert.notEqual(witchy.blocks[0].color, '#000000', 'editing the copy leaves the theme alone');
  assert.equal(motionLabel(witchy), 'Twinkle');
  assert.equal(motionLabel({ ...newPattern(), animation: 'sound', sound: 'ripples' }), '♪ Ripples');
});

test('schedule helpers', () => {
  const s = { ...newSchedule(), id: 'x', season: { from: [12, 1], to: [1, 6] } } as Schedule;
  // \s also matches the narrow no-break space some locales put before "PM".
  assert.match(scheduleSummary(s), /^Sunset → 11:00\sPM · Every day · Dec 1–Jan 6$/);
  assert.equal(usesSun(s), true);
  assert.equal(usesSun({ on: { kind: 'time', time: '18:00' }, off: undefined }), false);
  assert.equal(showingLabel('last'), 'Last used');
  assert.equal(showingLabel('autopilot', 'Pumpkin Patch'), 'Holiday autopilot (Pumpkin Patch)');
  assert.equal(showingLabel('gone'), 'Missing pattern');
  const groups = patternChoices(BUILT_IN_THEMES, ['builtin-halloween-witchy']);
  assert.deepEqual(groups[0][1].map((p) => p.name), ['Witchy']);
  assert.ok(!groups.some(([label]) => label === 'My Patterns'), 'empty groups are dropped');
});
