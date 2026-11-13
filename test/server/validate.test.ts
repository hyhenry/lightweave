import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequest, cleanLocation, cleanPattern, cleanSchedule } from '../../server/validate.ts';
import { hostOnly, sameHost } from '../../server/wled/client.ts';

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

test('schedule times must be real clock times; days must be whole weekdays', () => {
  const s = cleanSchedule({ on: { kind: 'time', time: '25:99' }, off: { kind: 'time', time: '23:60' }, days: [1.5, 2, '3', 2, 9] }, known);
  assert.deepEqual(s.on, { kind: 'sunset', offset: 0 });
  assert.deepEqual(s.off, { kind: 'time', time: '23:00' });
  assert.deepEqual(s.days, [2, 3]);
  assert.deepEqual(cleanSchedule({ on: { kind: 'time', time: '00:00' } }, known).on, { kind: 'time', time: '00:00' });
  assert.deepEqual(cleanSchedule({ on: { kind: 'time', time: '23:59' } }, known).on, { kind: 'time', time: '23:59' });
});

test('a schedule whose lights are all gone is switched off, never widened to every light', () => {
  const orphan = cleanSchedule({ deviceIds: ['gone'], enabled: true }, known);
  assert.deepEqual(orphan.deviceIds, ['gone'], 'targets nothing, rather than every light');
  assert.equal(orphan.enabled, false);
  assert.equal(cleanSchedule({ deviceIds: [], enabled: true }, known).enabled, true, 'an empty list still means all lights');
  assert.equal(cleanSchedule({ deviceIds: ['d1', 'gone'] }, known).enabled, true);
});

test('locations need real coordinates', () => {
  assert.equal(cleanLocation({ name: 'X', lat: 'north', lon: 1 }), undefined);
  assert.equal(cleanLocation({ name: 'X', lat: 95, lon: 1 }), undefined);
  assert.equal(cleanLocation({ name: 'X', lat: 50, lon: -190 }), undefined);
  assert.equal(cleanLocation(null), undefined);
  assert.deepEqual(cleanLocation({ name: 'Edmonton, AB', lat: '53.55', lon: -113.49 }), { name: 'Edmonton, AB', lat: 53.55, lon: -113.49 });
  assert.equal(cleanLocation({ lat: 53.55, lon: -113.49 })!.name, 'My location');
});

test('controller addresses: with or without http://, and hostnames that start with "http"', () => {
  assert.equal(hostOnly('192.168.2.20:8080'), '192.168.2.20');
  assert.equal(hostOnly('http://192.168.2.20/'), '192.168.2.20');
  assert.equal(hostOnly('httpd-lights.local'), 'httpd-lights.local');
  assert.ok(sameHost('http://192.168.2.20/', '192.168.2.20:80'));
  assert.ok(sameHost('HTTP://Roof.local', 'roof.local'));
  assert.ok(!sameHost('192.168.2.20', '192.168.2.22'));
});
