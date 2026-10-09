import type { Clip } from '../../shared/types';
import { filterPresets, visualEffects } from './visualEffects';
function range(value: unknown, min: number, max: number, name: string) { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${name}`); }
const color = (value: string) => { if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) throw new Error('Invalid effect color'); };
export function validateVisuals(clip: Clip): void {
  if (clip.blendMode && !['normal', 'multiply', 'screen', 'overlay', 'add'].includes(clip.blendMode)) throw new Error('Invalid blend mode');
  for (const effect of clip.effects) {
    if (!effect || typeof effect.enabled !== 'boolean' || !effect.params) throw new Error('Invalid effect');
    if (effect.type in visualEffects) range(effect.params.amount, 0, 1, 'effect strength');
  }
  if (clip.type !== 'media') return;
  if (!clip.adjust) throw new Error('Missing color adjustments');
  for (const name of ['brightness', 'contrast', 'saturation', 'temperature'] as const) range(clip.adjust[name], -1, 1, name);
  for (const name of ['vignette', 'sharpen'] as const) range(clip.adjust[name], 0, 1, name);
  if (clip.filter) { if (!(filterPresets as readonly string[]).includes(clip.filter.preset)) throw new Error('Invalid filter'); range(clip.filter.intensity, 0, 1, 'filter intensity'); }
  if (clip.mask) {
    const mask = clip.mask; if (!['rectangle', 'ellipse', 'linear'].includes(mask.shape) || typeof mask.invert !== 'boolean') throw new Error('Invalid mask');
    for (const name of ['x', 'y'] as const) range(mask[name], 0, 1, 'mask position');
    for (const name of ['width', 'height'] as const) range(mask[name], .01, 2, 'mask size');
    range(mask.rotation, -360, 360, 'mask rotation'); range(mask.feather, 0, 1, 'mask feather');
  }
  if (clip.chromaKey) { color(clip.chromaKey.color); for (const name of ['similarity', 'smoothness', 'spill'] as const) range(clip.chromaKey[name], 0, 1, `chroma ${name}`); }
  if (clip.frame) { color(clip.frame.borderColor); range(clip.frame.radius, 0, 500, 'corner radius'); range(clip.frame.borderWidth, 0, 100, 'border width'); range(clip.frame.shadow, 0, 100, 'frame shadow'); }
}
