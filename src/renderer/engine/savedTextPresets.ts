import type { SavedTextPreset, TextClip, TextStyle } from '../../shared/types';
import { defaultTextStyle } from './text';
export function captureTextPreset(clip: TextClip): SavedTextPreset {
  const animations: NonNullable<SavedTextPreset['animations']> = {};
  for (const key of ['animIn', 'animOut', 'animLoop'] as const) if (clip[key]) animations[key] = structuredClone(clip[key]);
  return { ...structuredClone(clip.style), animations };
}
export function applyTextPreset(clip: TextClip, preset: Partial<TextStyle> & Pick<SavedTextPreset, 'animations'>): void {
  const { animations, ...style } = preset;
  clip.style = structuredClone({ ...defaultTextStyle, ...style });
  // Older style-only presets remain style-only; newly saved presets replace all motion.
  if (animations) {
    for (const key of ['animIn', 'animOut', 'animLoop'] as const) {
      if (animations[key]) clip[key] = structuredClone(animations[key]); else delete clip[key];
    }
    if (clip.caption) clip.caption.preset = 'plain';
  }
}
