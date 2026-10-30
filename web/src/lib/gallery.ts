// How the Themes tab is laid out: holidays coming up, themes for any time, then
// the rest of the year's holidays.

import { daysUntil, sortCategories } from '../../../shared/holidays.ts';

const SOON_DAYS = 60;

export interface CategoryGroups {
  soon: string[]; // holidays in the next ~2 months (at least the next one), soonest first
  anytime: string[]; // categories that aren't holidays, in their original order
  later: string[]; // every other holiday, by date
}

export function groupCategories(categories: string[], now = new Date()): CategoryGroups {
  const holidays = sortCategories(
    categories.filter((c) => daysUntil(c, now) !== undefined),
    now,
  );
  let soon = holidays.filter((c) => daysUntil(c, now)! <= SOON_DAYS);
  if (!soon.length) soon = holidays.slice(0, 1);
  return {
    soon,
    anytime: categories.filter((c) => daysUntil(c, now) === undefined),
    later: holidays.filter((c) => !soon.includes(c)),
  };
}
