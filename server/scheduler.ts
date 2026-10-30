// Runs schedules: every few seconds, fire the on/off events that fell due since
// the last check. Works whether or not anyone has the app open.

import type { Pattern, Schedule } from '../shared/types.ts';
import { AUTOPILOT, LAST_USED, autopilotPattern, dueEvents, isRunning } from '../shared/schedule.ts';
import { store } from './store.ts';
import * as player from './player.ts';

const TICK_MS = 20_000;

/** What a schedule will show (undefined for "Last used", which differs per light). */
export function resolvePattern(s: Schedule, now = new Date()): Pattern | undefined {
  if (s.patternId === LAST_USED) return undefined;
  if (s.patternId === AUTOPILOT) return autopilotPattern(store.patterns(), store.favorites(), now);
  return store.pattern(s.patternId);
}

function devicesFor(s: Schedule) {
  const all = store.devices();
  return s.deviceIds.length ? all.filter((d) => s.deviceIds.includes(d.id)) : all;
}

async function turnOn(s: Schedule, now: Date) {
  const devices = devicesFor(s);
  if (s.patternId === LAST_USED) {
    // Turning on brings back each light's last pattern (or WLED's own look if it never had one).
    console.log(`[schedule] ${s.name}: on (last used)`);
    await Promise.allSettled(devices.map((d) => player.power(d, true)));
    return;
  }
  const pattern = resolvePattern(s, now);
  if (!pattern) return console.warn(`[schedule] ${s.name}: pattern not found`);
  console.log(`[schedule] ${s.name}: on (${pattern.name})`);
  await player.play(pattern, devices);
}

async function turnOff(s: Schedule) {
  console.log(`[schedule] ${s.name}: off`);
  await Promise.allSettled(devicesFor(s).map((d) => player.power(d, false)));
}

/**
 * After a restart, put on anything a schedule says should be on right now, so a
 * reboot in the evening doesn't leave the house dark until tomorrow.
 */
async function catchUp(now: Date) {
  for (const s of store.schedules().filter((x) => x.enabled && x.off && isRunning(x, store.settings(), now))) {
    if (s.patternId === LAST_USED) {
      await Promise.allSettled(devicesFor(s).filter((d) => store.isOff(d.id)).map((d) => player.power(d, true)));
      continue;
    }
    const pattern = resolvePattern(s, now);
    const stale = devicesFor(s).filter((d) => store.active()[d.id]?.id !== pattern?.id || store.isOff(d.id));
    if (pattern && stale.length) await player.play(pattern, stale);
  }
}

export function start() {
  let last = new Date();
  catchUp(last).catch((e) => console.error('[schedule] catch-up failed', e));
  setInterval(async () => {
    const now = new Date();
    const due = dueEvents(store.schedules(), store.settings(), last, now);
    last = now;
    for (const { schedule, kind } of due) {
      await (kind === 'on' ? turnOn(schedule, now) : turnOff(schedule)).catch((e) => console.error('[schedule]', e));
    }
  }, TICK_MS).unref();
}
