// Run: node scripts/check-backup.mjs
import assert from 'node:assert/strict';

import { parseManifest, planRestore } from '../src/lib/backup-format.ts';

const mem = (id) => ({
  id, createdAt: '2026-10-02T09:41:00.000Z', original: `originals/${id}.jpg`, rendered: `rendered/${id}.png`,
  shape: 'burst', filter: 'raw', grain: 0.3, caption: '', showDate: true, crop: { cy: 0.4, frac: 0.4 }, exportVersion: 1,
});

assert.throws(() => parseManifest('{nope'), /damaged/);
assert.throws(() => parseManifest('{"format":"other"}'), /not a CamArt/);
assert.throws(() => parseManifest('{"format":"camart-backup","schema":99,"memories":[]}'), /newer version/);
const ok = parseManifest(JSON.stringify({ format: 'camart-backup', schema: 1, memories: [mem('aaaaaa1')] }));
assert.equal(ok.memories.length, 1);

const files = new Set(['originals/aaaaaa1.jpg', 'rendered/aaaaaa1.png', 'originals/bbbbbb2.jpg', 'rendered/bbbbbb2.png']);
const evil = { ...mem('cccccc3'), rendered: '../../etc/passwd' };
const noFile = mem('dddddd4');
const r = planRestore([mem('aaaaaa1'), mem('bbbbbb2'), mem('bbbbbb2'), evil, noFile], new Set(['aaaaaa1']), (p) => files.has(p));
assert.deepEqual(r.add.map((m) => m.id), ['bbbbbb2']);
assert.equal(r.duplicates, 2);
assert.equal(r.invalid, 2);
console.log('backup format: ok');
