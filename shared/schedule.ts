// Schedule timing: when a schedule's on/off events fall, and which pattern
// "Holiday autopilot" picks. Pure, so the server and the app agree.

import type { Pattern, Schedule, Settings, Trigger } from './types.ts';
import { daysUntil } from './holidays.ts';
import { sunTime } from './sun.ts';

export const AUTOPILOT = 'autopilot';
/** Each light turns on with whatever it showed last. */
export const LAST_USED = 'last';
const FALLBACK_THEME = 'builtin-everyday-warm-white';

/** How many days ahead autopilot switches to a holiday's theme. */
const LEAD_DAYS: Record<string, number> = { Christmas: 30, Halloween: 21, Hanukkah: 8 };
const DEFAULT_LEAD = 7;
const NOT_AUTOPILOT = new Set(['Winter']); // a season, not a holiday
/** Holidays not every household marks: autopilot only uses them once one of their themes is a favorite. */
const OPT_IN = new Set(['Hanukkah']);

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** The theme autopilot would show on this date: favorite for the nearest holiday, else its first theme. */
export function autopilotPattern(patterns: Pattern[], favorites: string[], now = new Date()): Pattern | undefined {
  const favoriteCats = new Set(favorites.map((id) => patterns.find((p) => p.id === id)?.category));
  const holidays = [...new Set(patterns.filter((p) => p.builtIn).map((p) => p.category))]
    .filter((c) => !NOT_AUTOPILOT.has(c) && (!OPT_IN.has(c) || favoriteCats.has(c)))
    .map((c) => ({ c, days: daysUntil(c, now) }))
    .filter((h): h is { c: string; days: number } => h.days !== undefined && h.days <= (LEAD_DAYS[h.c] ?? DEFAULT_LEAD))
    .sort((a, b) => a.days - b.days);
  const category = holidays[0]?.c;
  if (category) {
    const fav = favorites.map((id) => patterns.find((p) => p.id === id)).find((p) => p?.category === category);
    return fav ?? patterns.find((p) => p.builtIn && p.category === category);
  }
  return patterns.find((p) => p.id === FALLBACK_THEME);
}

/** When a trigger happens on a given day, or undefined (no location for sun times, or no sunset that day). */
export function triggerTime(t: Trigger, day: Date, settings: Settings): Date | undefined {
  if (t.kind === 'time') {
    const [h, m] = t.time.split(':').map(Number);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
  }
  const loc = settings.location;
  if (!loc) return undefined;
  const sun = sunTime(day, loc.lat, loc.lon, t.kind);
  return sun && new Date(sun.getTime() + t.offset * 60_000);
}

function inSeason(s: Schedule, day: Date): boolean {
  if (!s.season) return true;
  const md = (m: number, d: number) => m * 100 + d;
  const x = md(day.getMonth() + 1, day.getDate());
  const from = md(...s.season.from);
  const to = md(...s.season.to);
  return from <= to ? x >= from && x <= to : x >= from || x <= to; // wraps past New Year
}

/** Does this schedule run on the day it would turn on? */
export function runsOn(s: Schedule, day: Date): boolean {
  return s.days.includes(day.getDay()) && inSeason(s, day);
}

export interface Window {
  on?: Date;
  off?: Date;
}

/** The on/off times for the schedule run that starts on `day`. An off time before the on time means the next morning. */
export function windowFor(s: Schedule, day: Date, settings: Settings): Window | undefined {
  if (!runsOn(s, day)) return undefined;
  const on = triggerTime(s.on, day, settings);
  if (!on) return undefined;
  let off = s.off && triggerTime(s.off, day, settings);
  if (s.off && off && off <= on) off = triggerTime(s.off, addDays(day, 1), settings);
  return { on, off };
}

/** Recent and upcoming runs around `now` (yesterday's might still be running after midnight). */
export function windowsAround(s: Schedule, now: Date, settings: Settings, daysAhead = 0): Window[] {
  const today = startOfDay(now);
  const out: Window[] = [];
  for (let i = -1; i <= daysAhead; i++) {
    const w = windowFor(s, addDays(today, i), settings);
    if (w) out.push(w);
  }
  return out;
}

/** The next on and off times after `now`, looking up to two weeks ahead. */
export function nextEvents(s: Schedule, now: Date, settings: Settings): { on?: Date; off?: Date } {
  const wins = windowsAround(s, now, settings, 14);
  return {
    on: wins.map((w) => w.on).find((t) => t && t > now),
    off: wins.map((w) => w.off).find((t) => t && t > now),
  };
}

export interface DueEvent {
  schedule: Schedule;
  kind: 'on' | 'off';
}

/** Every on/off event that fell in (since, now], in time order. Drives the server's scheduler. */
export function dueEvents(schedules: Schedule[], settings: Settings, since: Date, now: Date): DueEvent[] {
  const due: (DueEvent & { at: number })[] = [];
  for (const schedule of schedules.filter((s) => s.enabled)) {
    for (const w of windowsAround(schedule, now, settings)) {
      if (w.on && w.on > since && w.on <= now) due.push({ schedule, kind: 'on', at: w.on.getTime() });
      if (w.off && w.off > since && w.off <= now) due.push({ schedule, kind: 'off', at: w.off.getTime() });
    }
  }
  return due.sort((a, b) => a.at - b.at).map(({ schedule, kind }) => ({ schedule, kind }));
}

/** Is a run of this schedule (with an off time) in progress right now? */
export function isRunning(s: Schedule, settings: Settings, now: Date): boolean {
  return windowsAround(s, now, settings).some((w) => w.on && w.off && w.on <= now && now < w.off);
}
