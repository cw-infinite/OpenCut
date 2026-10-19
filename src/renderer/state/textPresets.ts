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
export const useTextPresets = create<{ styles: Record<string, TextStyle>; remove(name: string): Promise<void>; merge(styles: Record<string, TextStyle>, overwrite?: boolean): Promise<void> }>((set) => ({
  styles: {},
  remove: async name => { const styles = await window.opencut.textPresets.remove(name); set({ styles }); },
  merge: async (styles, overwrite = false) => {
    if (typeof window === 'undefined' || !window.opencut?.textPresets) return;
    let legacy: Record<string, TextStyle> = {};
    try { legacy = readTextPresets(localStorage); } catch { /* Browser storage must not block the native library. */ }
    const next = await window.opencut.textPresets.merge(overwrite ? styles : { ...legacy, ...styles }, overwrite);
    set({ styles: next });
  }
}));
