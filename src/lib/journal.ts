// Pure journal maths (no RN imports): shared by the app and scripts/check-journal.mjs.

type Dated = { createdAt: string };

const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Consecutive days with at least one memory, ending today (or yesterday, so a streak survives until tonight). */
export function streak(items: Dated[], today = new Date()) {
  const days = new Set(items.map((m) => key(new Date(m.createdAt))));
  let d = days.has(key(today)) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(key(d))) {
    n++;
    d = addDays(d, -1);
  }
  return { days: n, alive: days.has(key(today)) };
}

/** Memories from this date in earlier years; failing that, exactly one month ago. */
export function onThisDay<T extends Dated>(items: T[], today = new Date()) {
  const same = items.filter((m) => {
    const d = new Date(m.createdAt);
    return d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() < today.getFullYear();
  });
  if (same.length) {
    const years = today.getFullYear() - Math.max(...same.map((m) => new Date(m.createdAt).getFullYear()));
    return { label: years === 1 ? '1 year ago today' : `${years} years ago today`, items: same };
  }
  const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
  if (monthAgo.getDate() !== today.getDate()) return null; // e.g. 31 March has no 31 February
  const month = items.filter((m) => key(new Date(m.createdAt)) === key(monthAgo));
  return month.length ? { label: '1 month ago today', items: month } : null;
}
