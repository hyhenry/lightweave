import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunTime } from '../../shared/sun.ts';

const EDMONTON = { lat: 53.55, lon: -113.49 };
const minutesUtc = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
const near = (actual: number, expected: number, slack = 4) => assert.ok(Math.abs(actual - expected) <= slack, `${actual} vs ${expected}`);

test('Edmonton winter solstice: sunrise ~8:49, sunset ~16:16 MST (UTC−7)', () => {
  const day = new Date(2026, 11, 21);
  near(minutesUtc(sunTime(day, EDMONTON.lat, EDMONTON.lon, 'sunrise')!), (8 + 7) * 60 + 49);
  near(minutesUtc(sunTime(day, EDMONTON.lat, EDMONTON.lon, 'sunset')!), (16 + 7) * 60 + 16);
});

test('Edmonton summer solstice: sunrise ~5:06, sunset ~22:07 MDT (UTC−6)', () => {
  const day = new Date(2026, 5, 21);
  near(minutesUtc(sunTime(day, EDMONTON.lat, EDMONTON.lon, 'sunrise')!), (5 + 6) * 60 + 6);
  near(minutesUtc(sunTime(day, EDMONTON.lat, EDMONTON.lon, 'sunset')!) + 24 * 60, (22 + 6) * 60 + 7);
});

test('no sunset during polar day', () => {
  assert.equal(sunTime(new Date(2026, 5, 21), 78.2, 15.6, 'sunset'), undefined); // Svalbard
});
