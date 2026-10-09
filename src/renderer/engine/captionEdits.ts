import type { Project } from '../../shared/types';
import { editable, splitClip } from './timeline';

export function mergeCaption(project: Project, id: string): void {
  const { clip, track } = editable(project, id), next = track.clips[track.clips.indexOf(clip) + 1];
  if (clip.type !== 'text' || !clip.caption || next?.type !== 'text' || !next.caption) throw new Error('No following caption on this track');
  const words = clip.caption.words.length && next.caption.words.length ? [...clip.caption.words, ...next.caption.words.map(word => ({ ...word, start: word.start + next.start - clip.start, end: word.end + next.start - clip.start }))] : [];
  clip.content += ' ' + next.content; clip.duration = next.start + next.duration - clip.start;
  clip.caption.words = words; track.clips = track.clips.filter(item => item.id !== next.id);
}
export function splitCaption(project: Project, id: string, newId: string): void {
  const { clip } = editable(project, id); if (clip.type !== 'text' || !clip.caption) throw new Error('Select a caption');
  const tokens = clip.content.trim().split(/\s+/), middle = Math.ceil(tokens.length / 2);
  if (tokens.length < 2) throw new Error('A caption needs at least two words to split');
  const timed = clip.caption.words.length === tokens.length;
  let offset = timed ? clip.caption.words[middle].start : Math.round(clip.duration * middle / tokens.length);
  if (offset <= 0 || offset >= clip.duration) offset = Math.round(clip.duration / 2);
  const words = clip.caption.words.map(word => ({ ...word }));
  splitClip(project, id, clip.start + offset, newId);
  const right = editable(project, newId).clip;
  clip.content = tokens.slice(0, middle).join(' ');
  clip.caption.words = timed ? words.slice(0, middle) : [];
  if (right.type === 'text' && right.caption) {
    right.content = tokens.slice(middle).join(' ');
    right.caption.words = timed ? words.slice(middle).map(word => ({ ...word, start: word.start - offset, end: word.end - offset })) : [];
  }
}
