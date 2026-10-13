import type { Project, TextStyle } from '../../shared/types';
import { setAnimatedValue } from './keyframes';
import { editable } from './timeline';

export function editTextStyles(project: Project, ids: string[], change: (style: TextStyle) => void): void {
  if (!ids.length) throw new Error('Select text clips to style.');
  const clips = ids.map(id => editable(project, id).clip);
  if (clips.some(clip => clip.type !== 'text')) throw new Error('Select only text or caption clips to style together.');
  for (const clip of clips) if (clip.type === 'text') change(clip.style);
}

export function commonValue<T>(values: T[]): T | undefined {
  return values.length && values.every(value => Object.is(value, values[0])) ? values[0] : undefined;
}

export function editTextPosition(project: Project, ids: string[], axis: 'x' | 'y', value: number, playhead: number): void {
  if (!Number.isFinite(value) || value < -2 || value > 3) throw new Error('Text position must be between -2 and 3.');
  if (!ids.length) throw new Error('Select text clips to position.');
  const clips = ids.map(id => editable(project, id).clip);
  if (clips.some(clip => clip.type !== 'text')) throw new Error('Select only text or caption clips to position together.');
  for (const clip of clips) setAnimatedValue(clip.transform[axis], Math.max(0, Math.min(clip.duration, playhead - clip.start)), value);
}
