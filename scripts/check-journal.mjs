// Run: node scripts/check-journal.mjs
import assert from 'node:assert/strict';

import { onThisDay, streak } from '../src/lib/journal.ts';

const at = (y, m, d) => ({ createdAt: new Date(y, m, d, 12).toISOString() });
const today = new Date(2026, 9, 2, 18);

assert.deepEqual(streak([], today), { days: 0, alive: false });
assert.deepEqual(streak([at(2026, 9, 2), at(2026, 9, 1), at(2026, 8, 30)], today), { days: 3, alive: true });
// Nothing yet today: yesterday's run still counts until the day ends.
assert.deepEqual(streak([at(2026, 9, 1), at(2026, 8, 30)], today), { days: 2, alive: false });
assert.equal(streak([at(2026, 8, 29)], today).days, 0); // gap breaks it

assert.equal(onThisDay([at(2026, 9, 2)], today), null); // today itself isn't a memory "ago"
assert.equal(onThisDay([at(2025, 9, 2), at(2024, 9, 2)], today).label, '1 year ago today');
assert.equal(onThisDay([at(2023, 9, 2)], today).label, '3 years ago today');
assert.equal(onThisDay([at(2026, 8, 2)], today).label, '1 month ago today');
assert.equal(onThisDay([at(2026, 1, 28)], new Date(2026, 2, 31)), null); // no 31 Feb
console.log('journal: ok');
