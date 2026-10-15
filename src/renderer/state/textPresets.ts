import { create } from 'zustand';
import type { TextStyle } from '../../shared/types';
import { validateTextStyle } from '../engine/textValidation';

const key = 'opencut.text-presets.v1';
export function readTextPresets(storage: Pick<Storage, 'getItem'>): Record<string, TextStyle> {
  const result: Record<string, TextStyle> = {};
  const saved = JSON.parse(storage.getItem(key) ?? '{}');
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return result;
  for (const [name, style] of Object.entries(saved)) {
    try { validateTextStyle(style as TextStyle); Object.defineProperty(result, name, { value: style, enumerable: true, writable: true, configurable: true }); } catch { /* Ignore invalid entries. */ }
  }
  return result;
}
export const useTextPresets = create<{ styles: Record<string, TextStyle>; merge(styles: Record<string, TextStyle>, overwrite?: boolean): void }>((set, get) => ({
  styles: {},
  merge: (styles, overwrite = false) => {
    if (typeof localStorage === 'undefined') return;
    const saved = readTextPresets(localStorage);
    const next = overwrite ? { ...saved, ...styles } : { ...styles, ...saved };
    for (const style of Object.values(next)) validateTextStyle(style);
    localStorage.setItem(key, JSON.stringify(next));
    set({ styles: next });
  }
}));
