// Pure, dependency-free: shared by the app and scripts/check-backup.mjs.

export const BACKUP_FORMAT = 'camart-backup';
export const SCHEMA = 1;

export type Memory = {
  id: string;
  createdAt: string; // ISO capture time
  original: string; // path relative to the app store, e.g. originals/<id>.jpg
  rendered: string; // rendered/<id>.png
  shape: string;
  edge?: string; // die-cut edge colour key (optional: older memories lack it)
  cutout?: boolean; // subject lifted out of the photo instead of a frame (optional)
  texts?: { id: string; t: string; x: number; y: number; color: string; size: string }[]; // free text (optional)
  filter: string;
  grain: number;
  caption: string;
  showDate: boolean;
  crop: { cy: number; frac: number };
  exportVersion: number;
};

export type Manifest = { format: string; schema: number; exportedAt: string; memories: Memory[] };

const SAFE_PATH = /^(originals|rendered)\/[A-Za-z0-9_-]+\.(jpg|png)$/;

export function isMemory(m: any): m is Memory {
  return (
    m && typeof m === 'object' &&
    typeof m.id === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(m.id) &&
    typeof m.createdAt === 'string' && !Number.isNaN(Date.parse(m.createdAt)) &&
    typeof m.original === 'string' && SAFE_PATH.test(m.original) &&
    typeof m.rendered === 'string' && SAFE_PATH.test(m.rendered) &&
    typeof m.shape === 'string' && typeof m.filter === 'string' && (m.edge === undefined || typeof m.edge === 'string') && (m.texts === undefined || Array.isArray(m.texts)) &&
    typeof m.grain === 'number' && typeof m.caption === 'string' &&
    typeof m.showDate === 'boolean' && typeof m.exportVersion === 'number'
  );
}

/** Throws a user-readable message when the manifest is not a CamArt backup we can read. */
export function parseManifest(text: string): Manifest {
  let j: any;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('This backup is damaged: its index file is unreadable.');
  }
  if (j?.format !== BACKUP_FORMAT) throw new Error('This file is not a CamArt backup.');
  if (typeof j.schema !== 'number' || j.schema > SCHEMA)
    throw new Error('This backup was made by a newer version of CamArt. Update the app and try again.');
  if (!Array.isArray(j.memories)) throw new Error('This backup is damaged: no memories list.');
  return j;
}

/** Split incoming memories into new valid ones vs. skipped (duplicate) vs. invalid. */
export function planRestore(incoming: unknown[], existingIds: Set<string>, has: (path: string) => boolean) {
  const add: Memory[] = [];
  let duplicates = 0, invalid = 0;
  const seen = new Set(existingIds);
  for (const m of incoming) {
    if (!isMemory(m) || !has(m.original) || !has(m.rendered)) invalid++;
    else if (seen.has(m.id)) duplicates++;
    else {
      seen.add(m.id);
      add.push(m);
    }
  }
  return { add, duplicates, invalid };
}
