// Pure logic: boards, titles, trips. No DOM. Unit-tested in tests/logic.spec.mjs.
export const DRINKS = [
  { k: 'water', label: 'Water', icon: '💧', title: 'Water Champ' },
  { k: 'dietcoke', label: 'Diet Coke', icon: '🥤', title: 'Diet Coke Royalty' },
  { k: 'coffee', label: 'Coffee', icon: '☕', title: 'Caffeine Captain' },
  { k: 'beer', label: 'Beer', icon: '🍺', title: 'Brew Boss' },
  { k: 'margarita', label: 'Margarita', icon: '🍹', title: 'Marg Monarch' },
];
export const CATS = [{ k: 'meal', label: 'Meal', icon: '🍽️' }, { k: 'snack', label: 'Snack', icon: '🍿' }, { k: 'restaurant', label: 'Restaurant', icon: '🧾' }];
export const drinkInfo = (k) => DRINKS.find((d) => d.k === k) || { k, label: k, icon: '🥂', title: `${k} Legend` };
// Diet Coke title honors each person's chosen crown (King/Queen), else "Royalty".
export function drinkTitle(k, person) {
  if (k === 'dietcoke' && person && (person.crown === 'King' || person.crown === 'Queen')) return `Diet Coke ${person.crown}`;
  return drinkInfo(k).title;
}
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const monthKey = (t) => dayKey(t).slice(0, 7);
export const inTrip = (trip, t) => !!trip && dayKey(t) >= trip.start && dayKey(t) <= trip.end;
// The trip a new log gets tagged with: an open (not archived) trip whose dates cover now.
export const activeTrip = (trips, now = Date.now()) => trips.filter((x) => !x.archived && inTrip(x, now)).sort((a, b) => b.ca - a.ca)[0] || null;

// scope: { kind: 'all' } | { kind: 'month', key } | { kind: 'trip', id } | { kind: 'day', key, trip? }
export function inScope(r, scope) {
  if (!scope || scope.kind === 'all') return true;
  if (scope.kind === 'month') return monthKey(r.at) === scope.key;
  if (scope.kind === 'trip') return r.trip === scope.id;
  if (scope.kind === 'day') return dayKey(r.at) === scope.key && (!scope.trip || r.trip === scope.trip);
  return true;
}
export function drinkBoards(drinks, scope) {
  const ds = drinks.filter((d) => inScope(d, scope));
  const per = {}; // kind -> who -> n
  const tot = {};
  for (const d of ds) { (per[d.kind] ||= {})[d.who] = ((per[d.kind] || {})[d.who] || 0) + 1; tot[d.who] = (tot[d.who] || 0) + 1; }
  const rank = (m) => Object.entries(m).map(([who, n]) => ({ who, n })).sort((a, b) => b.n - a.n || a.who.localeCompare(b.who));
  return { total: ds.length, overall: rank(tot), byKind: Object.fromEntries(Object.entries(per).map(([k, m]) => [k, rank(m)])) };
}
export function biteStats(bites, ratings) {
  const live = new Set(bites.map((b) => b.id));
  const by = {};
  for (const r of ratings) if (live.has(r.bite)) (by[r.bite] ||= []).push(r);
  return bites.map((b) => { const rs = by[b.id] || []; const avg = rs.length ? rs.reduce((s, r) => s + r.score, 0) / rs.length : null; return { ...b, ratings: rs, avg, n: rs.length }; });
}
export function biteBoards(bites, ratings, scope, minCritic = 2) {
  const bs = bites.filter((b) => inScope(b, scope));
  const stats = biteStats(bs, ratings);
  const rated = stats.filter((s) => s.n).sort((a, b) => b.avg - a.avg || b.n - a.n || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const top = rated.slice(0, 5), bottom = rated.length > 1 ? [...rated].reverse().slice(0, Math.min(5, rated.length - top.length || 1)) : [];
  const snacks = {};
  for (const s of stats) if (s.cat === 'snack') snacks[s.by] = (snacks[s.by] || 0) + 1;
  const crit = {};
  for (const s of stats) for (const r of s.ratings) { const c = (crit[r.who] ||= { who: r.who, n: 0, sum: 0 }); c.n++; c.sum += r.score; }
  const critics = Object.values(crit).filter((c) => c.n >= minCritic).map((c) => ({ ...c, avg: c.sum / c.n }));
  const generous = [...critics].sort((a, b) => b.avg - a.avg || b.n - a.n || a.who.localeCompare(b.who))[0] || null;
  const harsh = critics.length > 1 ? [...critics].sort((a, b) => a.avg - b.avg || b.n - a.n || a.who.localeCompare(b.who))[0] : null;
  const snackRank = Object.entries(snacks).map(([who, n]) => ({ who, n })).sort((a, b) => b.n - a.n || a.who.localeCompare(b.who));
  return { count: bs.length, top, bottom, snackChamp: snackRank[0] || null, snackRank, generous, harsh, critics };
}
// Awards for a trip or a day: one line per title, ties broken by name.
export function awards(drinks, bites, ratings, scope, people) {
  const nm = (id) => (people[id] && people[id].name) || 'Someone';
  const pl = (n, w) => `${n} ${n === 1 ? w : w + 's'}`;
  const out = [];
  const db = drinkBoards(drinks, scope);
  if (db.overall[0]) out.push({ title: 'Chug Champion', icon: '🏆', who: nm(db.overall[0].who), detail: pl(db.overall[0].n, 'drink') });
  const ord = (k) => { const i = DRINKS.findIndex((d) => d.k === k); return i < 0 ? 99 : i; };
  for (const [k, rows] of Object.entries(db.byKind).sort(([a], [b]) => ord(a) - ord(b) || a.localeCompare(b))) { const i = drinkInfo(k); out.push({ title: drinkTitle(k, people[rows[0].who]), icon: i.icon, who: nm(rows[0].who), detail: `${rows[0].n} ${i.label.toLowerCase()}` }); }
  const bb = biteBoards(bites, ratings, scope, 1);
  if (bb.top[0]) out.push({ title: 'Best Bite', icon: '🥇', who: bb.top[0].name, detail: `${bb.top[0].avg.toFixed(1)} / 10` });
  if (bb.bottom[0] && bb.bottom[0].id !== bb.top[0]?.id) out.push({ title: 'Bad Bite', icon: '🙈', who: bb.bottom[0].name, detail: `${bb.bottom[0].avg.toFixed(1)} / 10` });
  if (bb.snackChamp) out.push({ title: 'Snack Champ', icon: '🍿', who: nm(bb.snackChamp.who), detail: pl(bb.snackChamp.n, 'snack') });
  if (bb.generous) out.push({ title: 'Most Generous Critic', icon: '😇', who: nm(bb.generous.who), detail: `avg ${bb.generous.avg.toFixed(1)}` });
  if (bb.harsh) out.push({ title: 'Harshest Critic', icon: '🧐', who: nm(bb.harsh.who), detail: `avg ${bb.harsh.avg.toFixed(1)}` });
  return out;
}
export const tripDays = (trip) => { const out = []; for (let d = new Date(trip.start + 'T12:00'); dayKey(d) <= trip.end; d.setDate(d.getDate() + 1)) out.push(dayKey(d)); return out; };
export const isFinalNight = (trip, now = Date.now()) => !!trip && dayKey(now) === trip.end;
