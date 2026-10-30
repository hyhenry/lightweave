import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequest, cleanLocation, cleanPattern, cleanSchedule } from '../../server/validate.ts';

const known = { pattern: (id: string) => id === 'p1', device: (id: string) => id === 'd1' };

test('patterns need at least one color and get safe values', () => {
  assert.throws(() => cleanPattern({ blocks: [] }), BadRequest);
  const p = cleanPattern({ blocks: [{ color: 'red', count: 500 }], animation: 'sound', sound: 'nope', brightness: -5 });
  assert.deepEqual(p.blocks, [{ color: '#FFFFFF', count: 100 }]);
  assert.equal(p.sound, 'bounceMeter');
  assert.equal(p.brightness, 1);
  assert.equal(cleanPattern({ blocks: [{ color: '#000000', count: 1 }] }).sound, undefined);
});

test('schedules drop unknown devices, empty days and bad times', () => {
  const s = cleanSchedule({ patternId: 'p1', deviceIds: ['d1', 'gone'], days: [], on: { kind: 'time', time: '7pm' }, season: { from: [13, 40], to: [1, 1] } }, known);
  assert.equal(s.patternId, 'p1');
  assert.deepEqual(s.deviceIds, ['d1']);
  assert.deepEqual(s.days, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(s.on, { kind: 'sunset', offset: 0 });
  assert.deepEqual(s.season, { from: [12, 31], to: [1, 1] });
  assert.equal(s.name, 'Lights on');
});

test('locations need real coordinates', () => {
  assert.equal(cleanLocation({ name: 'X', lat: 'north', lon: 1 }), undefined);
  assert.deepEqual(cleanLocation({ name: 'Edmonton, AB', lat: '53.55', lon: -113.49 }), { name: 'Edmonton, AB', lat: 53.55, lon: -113.49 });
});
