import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysUntil, HOLIDAYS, nextOccurrence, sortCategories } from '../../shared/holidays.ts';

const dateOf = (category: string, year: number) => HOLIDAYS.find((h) => h.category === category)!.date(year).toDateString();

test('moveable holidays land on the right days', () => {
  assert.equal(dateOf('Easter', 2026), new Date(2026, 3, 5).toDateString());
  assert.equal(dateOf('Easter', 2027), new Date(2027, 2, 28).toDateString());
  assert.equal(dateOf('Victoria Day', 2026), new Date(2026, 4, 18).toDateString()); // May 24 is a Sunday
  assert.equal(dateOf('Victoria Day', 2027), new Date(2027, 4, 24).toDateString()); // May 24 is a Monday
  assert.equal(dateOf('Thanksgiving', 2026), new Date(2026, 9, 12).toDateString());
  assert.equal(dateOf('Thanksgiving', 2027), new Date(2027, 9, 11).toDateString());
  assert.equal(dateOf('Hanukkah', 2026), new Date(2026, 11, 4).toDateString());
});

test('a holiday counts as upcoming on the day itself, then rolls to next year', () => {
  assert.equal(daysUntil('Halloween', new Date(2026, 9, 31, 20)), 0);
  assert.equal(daysUntil('Halloween', new Date(2026, 9, 29)), 2);
  assert.equal(nextOccurrence('Halloween', new Date(2026, 10, 1))!.getFullYear(), 2027);
  assert.equal(daysUntil('Everyday & Celebrations'), undefined);
});

test('categories sort soonest first, with non-holidays last', () => {
  const sorted = sortCategories(['Everyday & Celebrations', 'Christmas', 'Canada Day', 'Halloween', 'Sound Reactive'], new Date(2026, 9, 29));
  assert.deepEqual(sorted, ['Halloween', 'Christmas', 'Canada Day', 'Everyday & Celebrations', 'Sound Reactive']);
});
