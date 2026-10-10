import { test, expect } from '@playwright/test';
import { drinkBoards, biteBoards, awards, activeTrip, tripDays, drinkTitle, inScope, isFinalNight } from '../src/logic.js';
const at = (s) => new Date(s).getTime();
test('drink boards rank per kind, all-time and monthly', () => {
  const ds = [{ who: 'a', kind: 'water', at: at('2026-10-01T10:00') }, { who: 'a', kind: 'water', at: at('2026-10-02T10:00') }, { who: 'b', kind: 'water', at: at('2026-09-02T10:00') }, { who: 'b', kind: 'dietcoke', at: at('2026-10-03T10:00') }];
  const all = drinkBoards(ds, { kind: 'all' });
  expect(all.byKind.water[0]).toEqual({ who: 'a', n: 2 });
  expect(drinkBoards(ds, { kind: 'month', key: '2026-09' }).total).toBe(1);
  expect(drinkTitle('dietcoke', { crown: 'Queen' })).toBe('Diet Coke Queen');
  expect(drinkTitle('dietcoke', {})).toBe('Diet Coke Royalty');
  expect(drinkTitle('water')).toBe('Water Champ');
});
test('bite boards: top/bottom, snack champ, generous vs harsh critics', () => {
  const bites = [{ id: 'x', name: 'X', cat: 'snack', by: 'a', at: 1 }, { id: 'y', name: 'Y', cat: 'meal', by: 'b', at: 1 }, { id: 'z', name: 'Z', cat: 'snack', by: 'a', at: 1 }];
  const r = (bite, who, score) => ({ bite, who, score });
  const ratings = [r('x', 'a', 10), r('y', 'a', 8), r('x', 'b', 4), r('y', 'b', 2), r('gone', 'b', 1)];
  const bb = biteBoards(bites, ratings, { kind: 'all' });
  expect(bb.top[0].name).toBe('X'); expect(bb.top[0].avg).toBe(7);
  expect(bb.bottom[0].name).toBe('Y');
  expect(bb.snackChamp).toEqual({ who: 'a', n: 2 });
  expect(bb.generous.who).toBe('a'); expect(bb.harsh.who).toBe('b');
});
test('trips: active by date, days list, final night, scope by tag, awards', () => {
  const t = { id: 't1', start: '2027-05-15', end: '2027-05-18', archived: false, ca: 1 };
  expect(activeTrip([t], at('2027-05-16T20:00')).id).toBe('t1');
  expect(activeTrip([t], at('2027-05-19T08:00'))).toBe(null);
  expect(activeTrip([{ ...t, archived: true }], at('2027-05-16T20:00'))).toBe(null);
  expect(tripDays(t)).toEqual(['2027-05-15', '2027-05-16', '2027-05-17', '2027-05-18']);
  expect(isFinalNight(t, at('2027-05-18T21:00'))).toBe(true);
  expect(inScope({ trip: 't1', at: 0 }, { kind: 'trip', id: 't1' })).toBe(true);
  const aw = awards([{ who: 'p', kind: 'beer', trip: 't1', at: 0 }], [], [], { kind: 'trip', id: 't1' }, { p: { name: 'Pat' } });
  expect(aw.map((a) => a.title)).toEqual(['Chug Champion', 'Brew Boss']);
});
