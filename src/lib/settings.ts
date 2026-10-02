import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

export type Appearance = 'system' | 'light' | 'dark';
type Settings = { haptics: boolean; appearance: Appearance };

const file = new File(Paths.document, 'settings.json');
let state: Settings = { haptics: true, appearance: 'system' };
try {
  if (file.exists) state = { ...state, ...JSON.parse(file.textSync()) };
} catch {}

const listeners = new Set<() => void>();

export const getSettings = () => state;

export function setSettings(patch: Partial<Settings>) {
  state = { ...state, ...patch };
  file.write(JSON.stringify(state));
  listeners.forEach((l) => l());
}

export const useSettings = () =>
  useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), getSettings);
