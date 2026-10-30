// Schedule helpers for the Lights tab.

import type { Pattern, Schedule } from '../../../shared/types.ts';
import { sortCategories } from '../../../shared/holidays.ts';
import { AUTOPILOT, LAST_USED } from '../../../shared/schedule.ts';
import { MONTHS, daysLabel, triggerLabel } from './format.ts';

export type Draft = Omit<Schedule, 'id'> & { id?: string };

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export function newSchedule(): Draft {
  return { name: 'Evening lights', enabled: true, patternId: AUTOPILOT, deviceIds: [], on: { kind: 'sunset', offset: 0 }, off: { kind: 'time', time: '23:00' }, days: EVERY_DAY };
}

/** Needs a location for sunrise/sunset times. */
export function usesSun(s: Pick<Schedule, 'on' | 'off'>) {
  return s.on.kind !== 'time' || (!!s.off && s.off.kind !== 'time');
}

/** "Sunset → 11:00 PM · Every day · Dec 1–Jan 6" */
export function scheduleSummary(s: Schedule) {
  const season = s.season ? ` · ${MONTHS[s.season.from[0] - 1]} ${s.season.from[1]}–${MONTHS[s.season.to[0] - 1]} ${s.season.to[1]}` : '';
  return `${triggerLabel(s.on)} → ${s.off ? triggerLabel(s.off) : 'stays on'} · ${daysLabel(s.days)}${season}`;
}

/** What the schedule shows, given the server's pick for it (`showing`). */
export function showingLabel(patternId: string, showing?: string) {
  if (patternId === LAST_USED) return 'Last used';
  if (patternId === AUTOPILOT) return `Holiday autopilot${showing ? ` (${showing})` : ''}`;
  return showing ?? 'Missing pattern';
}

/** The "Show" list, grouped: favorites, the household's own, then themes by upcoming holiday. */
export function patternChoices(patterns: Pattern[], favorites: string[]): [string, Pattern[]][] {
  const favs = favorites.map((id) => patterns.find((p) => p.id === id)).filter((p): p is Pattern => !!p);
  const themes = patterns.filter((p) => p.builtIn);
  const categories = sortCategories([...new Set(themes.map((p) => p.category))]);
  const groups: [string, Pattern[]][] = [
    ['★ Favorites', favs],
    ['My Patterns', patterns.filter((p) => !p.builtIn)],
    ...categories.map((c): [string, Pattern[]] => [c, themes.filter((p) => p.category === c)]),
  ];
  return groups.filter(([, list]) => list.length);
}
