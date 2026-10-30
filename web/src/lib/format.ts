// Small display formatters. Pure, so they're tested with `npm test`.

import type { Trigger } from '../../../shared/types.ts';
import { daysUntil, nextOccurrence } from '../../../shared/holidays.ts';

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "18:30" → "6:30 PM" (in the viewer's locale). */
export function clock(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "At sunset", "30 min before sunset", "1 hr 30 min after sunrise". */
export function offsetLabel(offset: number, event: string) {
  if (!offset) return `At ${event}`;
  const n = Math.abs(offset);
  const amount = n % 60 === 0 ? `${n / 60} hr` : n > 60 ? `${Math.floor(n / 60)} hr ${n % 60} min` : `${n} min`;
  return `${amount} ${offset < 0 ? 'before' : 'after'} ${event}`;
}

/** Short form for lists: "Sunset", "15 min before sunset", "11:00 PM". */
export function triggerLabel(t: Trigger) {
  if (t.kind === 'time') return clock(t.time);
  const label = offsetLabel(t.offset, t.kind).replace(/^At /, '');
  return label[0].toUpperCase() + label.slice(1);
}

export function daysLabel(days: number[]) {
  const sorted = [...days].sort();
  const key = sorted.join('');
  if (key === '0123456') return 'Every day';
  if (key === '12345') return 'Weekdays';
  if (key === '06') return 'Weekends';
  return sorted.map((d) => DAY_NAMES[d]).join(', ');
}

/** "Today 5:54 PM", "Tomorrow 7:00 AM", "Sat, Nov 7 5:40 PM". */
export function nextRunLabel(iso: string | undefined, now = new Date()) {
  if (!iso) return undefined;
  const d = new Date(iso);
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(d) - midnight(now)) / 86_400_000);
  const day = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

/** "Today", "Tomorrow", "in 12 days" or "Feb 14" for a holiday section; undefined for non-holidays. */
export function holidayWhenLabel(category: string, now = new Date()) {
  const days = daysUntil(category, now);
  if (days === undefined) return undefined;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 45) return `in ${days} days`;
  return nextOccurrence(category, now)!.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "http://192.168.2.20" → "192.168.2.20" */
export function hostLabel(host: string) {
  return host.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
