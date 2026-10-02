import { Skia } from '@shopify/react-native-skia';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { useSyncExternalStore } from 'react';

import { syncWidget } from './native';
import { BACKUP_FORMAT, SCHEMA, parseManifest, planRestore, type Memory } from './backup-format';

export type { Memory };

// App-owned storage. Paths in metadata are relative so they survive iOS
// container moves and restores onto another device.
const root = new Directory(Paths.document, 'camart');
for (const d of [root, new Directory(root, 'originals'), new Directory(root, 'rendered')]) d.create({ idempotent: true, intermediates: true });
const indexFile = new File(root, 'memories.json');

let list: Memory[] = [];
try {
  if (indexFile.exists) list = JSON.parse(indexFile.textSync());
} catch {
  // ponytail: a corrupt index starts empty but leaves files on disk; recovery = restore a backup.
}
const listeners = new Set<() => void>();

function commit(next: Memory[]) {
  const tmp = new File(root, 'memories.tmp.json');
  tmp.write(JSON.stringify(next));
  tmp.move(indexFile, { overwrite: true }); // atomic replace
  list = next;
  listeners.forEach((l) => l());
  syncWidget(next[0] ? uriOf(next[0].rendered) : null);
}

export const fileOf = (rel: string) => new File(root, rel);
export const uriOf = (rel: string) => fileOf(rel).uri;
export const getMemories = () => list;
export const useMemories = () =>
  useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), getMemories);

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Step 1: copy the camera's temporary file into app storage right away. */
export async function keepOriginal(cacheUri: string) {
  const id = newId();
  const original = `originals/${id}.jpg`;
  await new File(cacheUri).copy(fileOf(original));
  return { id, original };
}

/** Editor was closed without saving. */
export function discardOriginal(rel: string) {
  const f = fileOf(rel);
  if (f.exists && !list.some((m) => m.original === rel)) f.delete();
}

/** Final step: persist the rendered sticker + metadata. */
export function saveMemory(meta: Omit<Memory, 'rendered'>, png: Uint8Array): Memory {
  const rendered = `rendered/${meta.id}.png`;
  fileOf(rendered).write(png);
  const m: Memory = { ...meta, rendered };
  commit([m, ...list]);
  return m;
}

export function deleteMemory(id: string) {
  const m = list.find((x) => x.id === id);
  if (!m) return;
  commit(list.filter((x) => x.id !== id));
  for (const rel of [m.original, m.rendered]) if (fileOf(rel).exists) fileOf(rel).delete();
}

export function storageBytes() {
  return list.reduce((n, m) => n + (fileOf(m.original).size ?? 0) + (fileOf(m.rendered).size ?? 0), 0);
}

// --- Sticker export -------------------------------------------------------

/** A 512px transparent PNG of the sticker, the size chat apps expect for stickers. */
export async function stickerPng(m: Memory) {
  const src = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uriOf(m.rendered)));
  if (!src) throw new Error('Could not read this sticker.');
  const surface = Skia.Surface.MakeOffscreen(512, 512)!;
  surface.getCanvas().drawImageRect(src, Skia.XYWHRect(0, 0, src.width(), src.height()), Skia.XYWHRect(0, 0, 512, 512), Skia.Paint());
  surface.flush();
  const img = surface.makeImageSnapshot();
  const file = new File(Paths.cache, `CamArt-sticker-${m.id}.png`);
  file.write(img.encodeToBytes());
  return { file, base64: img.encodeToBase64() };
}

// --- Backup ---------------------------------------------------------------
// ponytail: zips in memory, so the ceiling is device RAM (~hundreds of MB).
// Stream entries with fflate's Zip class if libraries get that large.

export async function exportBackup() {
  const files: Zippable = {
    'camart.json': strToU8(JSON.stringify({ format: BACKUP_FORMAT, schema: SCHEMA, exportedAt: new Date().toISOString(), memories: list })),
  };
  for (const m of list) for (const rel of [m.original, m.rendered]) {
    const f = fileOf(rel);
    if (f.exists) files[rel] = [await f.bytes(), { level: 0 }]; // already compressed images
  }
  const out = new File(Paths.cache, `CamArt-backup-${new Date().toISOString().slice(0, 10)}.zip`);
  out.write(zipSync(files));
  await Sharing.shareAsync(out.uri, { mimeType: 'application/zip', UTI: 'public.zip-archive', dialogTitle: 'Save CamArt backup' });
}

export type RestoreResult = { added: number; duplicates: number; invalid: number };

export async function restoreBackup(uri: string, onStep: (s: string) => void): Promise<RestoreResult> {
  onStep('Reading backup…');
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(await new File(uri).bytes());
  } catch {
    throw new Error('This file is not a readable ZIP. It may be damaged or incomplete.');
  }
  if (!entries['camart.json']) throw new Error('This file is not a CamArt backup.');
  const manifest = parseManifest(strFromU8(entries['camart.json']));
  const plan = planRestore(manifest.memories, new Set(list.map((m) => m.id)), (p) => !!entries[p]?.length);

  const restored: Memory[] = [];
  let invalid = plan.invalid;
  for (const [i, m] of plan.add.entries()) {
    onStep(`Restoring ${i + 1} of ${plan.add.length}…`);
    fileOf(m.original).write(entries[m.original]);
    fileOf(m.rendered).write(entries[m.rendered]);
    // Real read-back: decode the restored sticker from disk before accepting it.
    const ok = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uriOf(m.rendered)));
    if (ok) restored.push(m);
    else {
      invalid++;
      for (const rel of [m.original, m.rendered]) if (fileOf(rel).exists) fileOf(rel).delete();
    }
  }
  if (restored.length)
    commit([...restored, ...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  return { added: restored.length, duplicates: plan.duplicates, invalid };
}

// --- Dates ----------------------------------------------------------------

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function byDay(ms: Memory[]) {
  const map = new Map<string, Memory[]>();
  for (const m of ms) {
    const k = dayKey(new Date(m.createdAt));
    map.set(k, [...(map.get(k) ?? []), m]);
  }
  return map;
}
