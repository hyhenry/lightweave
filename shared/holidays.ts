// Canadian holiday calendar. Theme categories that match a holiday are ordered
// by how soon that holiday comes up (and schedules can reuse these dates later).

type DateFn = (year: number) => Date;

const fixed = (month: number, day: number): DateFn => (y) => new Date(y, month - 1, day);

/** The nth weekday (0 = Sunday) of a month. */
const nthWeekday = (month: number, weekday: number, n: number): DateFn => (y) => {
  const first = new Date(y, month - 1, 1).getDay();
  return new Date(y, month - 1, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
};

/** Easter Sunday (anonymous Gregorian algorithm). */
function easter(y: number): Date {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

/** Victoria Day: the last Monday on or before May 24. */
function victoriaDay(y: number): Date {
  const may24 = new Date(y, 4, 24);
  return new Date(y, 4, 24 - ((may24.getDay() + 6) % 7));
}

/** First night of Hanukkah (follows the Hebrew calendar, so it's a lookup). */
const HANUKKAH: Record<number, [number, number]> = {
  2025: [12, 14], 2026: [12, 4], 2027: [12, 24], 2028: [12, 12], 2029: [12, 1],
  2030: [12, 20], 2031: [12, 9], 2032: [11, 27], 2033: [12, 16], 2034: [12, 6], 2035: [12, 25],
};
const hanukkah: DateFn = (y) => {
  const [m, d] = HANUKKAH[y] ?? [12, 10];
  return new Date(y, m - 1, d);
};

export const HOLIDAYS: { category: string; date: DateFn }[] = [
  { category: 'Valentine’s Day', date: fixed(2, 14) },
  { category: 'St. Patrick’s Day', date: fixed(3, 17) },
  { category: 'Easter', date: easter },
  { category: 'Victoria Day', date: victoriaDay },
  { category: 'Canada Day', date: fixed(7, 1) },
  { category: 'Truth & Reconciliation', date: fixed(9, 30) },
  { category: 'Thanksgiving', date: nthWeekday(10, 1, 2) },
  { category: 'Halloween', date: fixed(10, 31) },
  { category: 'Remembrance Day', date: fixed(11, 11) },
  { category: 'Hanukkah', date: hanukkah },
  { category: 'Winter', date: fixed(12, 21) },
  { category: 'Christmas', date: fixed(12, 25) },
  { category: 'New Year’s Eve', date: fixed(12, 31) },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Next time this category's holiday happens (today counts), or undefined if it isn't a holiday. */
export function nextOccurrence(category: string, from = new Date()): Date | undefined {
  const h = HOLIDAYS.find((x) => x.category === category);
  if (!h) return undefined;
  const today = startOfDay(from);
  const thisYear = h.date(today.getFullYear());
  return thisYear >= today ? thisYear : h.date(today.getFullYear() + 1);
}

export function daysUntil(category: string, from = new Date()): number | undefined {
  const next = nextOccurrence(category, from);
  if (!next) return undefined;
  return Math.round((next.getTime() - startOfDay(from).getTime()) / 86_400_000);
}

/** Holidays soonest first; categories that aren't holidays keep their order at the end. */
export function sortCategories(categories: string[], from = new Date()): string[] {
  const key = (c: string) => daysUntil(c, from) ?? 1000;
  return [...categories].sort((a, b) => key(a) - key(b));
}
