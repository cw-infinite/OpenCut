import { create } from 'zustand';
import type { SavedTextPreset } from '../../shared/types';
import { validateSavedTextPreset } from '../engine/textValidation';

const key = 'opencut.text-presets.v1';
export function readTextPresets(storage: Pick<Storage, 'getItem'>): Record<string, SavedTextPreset> {
  const result: Record<string, SavedTextPreset> = {};
  const saved = JSON.parse(storage.getItem(key) ?? '{}');
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return result;
  for (const [name, style] of Object.entries(saved)) {
    try { validateSavedTextPreset(style as SavedTextPreset); Object.defineProperty(result, name, { value: style, enumerable: true, writable: true, configurable: true }); } catch { /* Ignore invalid entries. */ }
  }
  return result;
}
export const useTextPresets = create<{ styles: Record<string, SavedTextPreset>; remove(name: string): Promise<void>; merge(styles: Record<string, SavedTextPreset>, overwrite?: boolean): Promise<void> }>((set) => ({
  styles: {},
  remove: async name => { const styles = await window.opencut.textPresets.remove(name); set({ styles }); },
  merge: async (styles, overwrite = false) => {
    if (typeof window === 'undefined' || !window.opencut?.textPresets) return;
    let legacy: Record<string, SavedTextPreset> = {};
    try { legacy = readTextPresets(localStorage); } catch { /* Browser storage must not block the native library. */ }
    const next = await window.opencut.textPresets.merge(overwrite ? styles : { ...legacy, ...styles }, overwrite);
    set({ styles: next });
  }
}));
