// Turning request bodies from the browser into clean, safe values.

import type { Pattern, Schedule, Settings, Trigger } from '../shared/types.ts';
import { ANIMATIONS } from '../shared/types.ts';
import { SOUND_EFFECT_IDS } from '../shared/sound.ts';
import { AUTOPILOT, LAST_USED } from '../shared/schedule.ts';

/** Thrown for bad input; Fastify turns `statusCode` into the response status. */
export class BadRequest extends Error {
  statusCode = 400;
}

const clamp = (n: unknown, lo: number, hi: number, fallback: number) =>
  Number.isFinite(Number(n)) ? Math.min(hi, Math.max(lo, Number(n))) : fallback;

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export function cleanPattern(body: any): Omit<Pattern, 'id'> & { id?: string } {
  if (!body || typeof body !== 'object') throw new BadRequest('Missing pattern');
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  if (!blocks.length) throw new BadRequest('A pattern needs at least one color');
  const animation = ANIMATIONS.includes(body.animation) ? body.animation : 'static';
  return {
    id: typeof body.id === 'string' ? body.id : undefined,
    name: String(body.name ?? 'My Pattern').slice(0, 60) || 'My Pattern',
    category: String(body.category ?? 'My Patterns').slice(0, 40),
    blocks: blocks.slice(0, 64).map((b: any) => ({
      color: /^#[0-9a-f]{6}$/i.test(b?.color) ? b.color.toUpperCase() : '#FFFFFF',
      count: Math.round(clamp(b?.count, 1, 100, 1)),
    })),
    animation,
    speed: clamp(body.speed, 1, 10, 4),
    direction: body.direction === 'reverse' ? 'reverse' : 'forward',
    brightness: Math.round(clamp(body.brightness, 1, 100, 100)),
    blend: Boolean(body.blend),
    sound: animation !== 'sound' ? undefined : SOUND_EFFECT_IDS.includes(body.sound) ? body.sound : 'bounceMeter',
  };
}

export function cleanBrightness(value: unknown) {
  return Math.round(clamp(value, 1, 100, 1));
}

export function cleanDeviceName(value: unknown) {
  return String(value ?? '').slice(0, 40);
}

function cleanTrigger(t: any, fallback: Trigger): Trigger {
  if (t?.kind === 'time' && /^\d{2}:\d{2}$/.test(t.time)) return { kind: 'time', time: t.time };
  if (t?.kind === 'sunset' || t?.kind === 'sunrise') return { kind: t.kind, offset: Math.round(clamp(t.offset, -180, 180, 0)) };
  return fallback;
}

/** `exists` checks pattern and device ids against what's saved. */
export function cleanSchedule(b: any, exists: { pattern: (id: string) => boolean; device: (id: string) => boolean }): Omit<Schedule, 'id'> {
  const monthDay = (v: any): [number, number] => [Math.round(clamp(v?.[0], 1, 12, 1)), Math.round(clamp(v?.[1], 1, 31, 1))];
  const days = Array.isArray(b?.days) ? [...new Set<number>(b.days.map(Number).filter((d: number) => d >= 0 && d <= 6))] : [];
  const patternId = b?.patternId;
  return {
    name: String(b?.name ?? '').slice(0, 40) || 'Lights on',
    enabled: b?.enabled !== false,
    patternId: patternId === AUTOPILOT || patternId === LAST_USED || exists.pattern(patternId) ? patternId : AUTOPILOT,
    deviceIds: Array.isArray(b?.deviceIds) ? b.deviceIds.filter((id: string) => exists.device(id)) : [],
    on: cleanTrigger(b?.on, { kind: 'sunset', offset: 0 }),
    off: b?.off ? cleanTrigger(b.off, { kind: 'time', time: '23:00' }) : undefined,
    days: days.length ? days.sort() : EVERY_DAY,
    season: b?.season ? { from: monthDay(b.season.from), to: monthDay(b.season.to) } : undefined,
  };
}

export function cleanLocation(loc: any): Settings['location'] {
  if (!loc || !Number.isFinite(Number(loc.lat)) || !Number.isFinite(Number(loc.lon))) return undefined;
  return { name: String(loc.name).slice(0, 60), lat: Number(loc.lat), lon: Number(loc.lon) };
}
