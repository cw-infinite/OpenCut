import type { Project, MediaClip } from '../../shared/types';
import { editable } from './timeline';

export function editMediaSelection(project: Project, ids: string[], change: (clip: MediaClip) => void): void {
  const clips = ids.map(id => editable(project, id).clip);
  if (!clips.length || clips.some(clip => clip.type !== 'media')) throw new Error('Select media clips to edit together.');
  for (const clip of clips) if (clip.type === 'media') change(clip);
}
