import type { Project } from '../../shared/types';
import { cutTimelineRange } from './rangeCut';

export interface TranscriptWord { id: string; text: string; start: number; end: number }
export function transcriptWords(project: Project, trackId: string): TranscriptWord[] {
  const track = project.tracks.find(track => track.id === trackId);
  return (track?.clips ?? []).flatMap(clip => clip.type !== 'text' || !clip.caption ? [] : clip.caption.words.map((word, index) => ({ id: `${clip.id}:${index}`, text: word.text, start: Math.max(clip.start, clip.start + word.start), end: Math.min(clip.start + clip.duration, clip.start + word.end) })).filter(word => word.end > word.start)).sort((a, b) => a.start - b.start);
}
export function transcriptRanges(words: TranscriptWord[], selected: string[]) {
  const ranges: { start: number; end: number }[] = [];
  for (const word of words.filter(word => selected.includes(word.id)).sort((a, b) => a.start - b.start)) {
    const last = ranges.at(-1);
    if (last && word.start <= last.end) last.end = Math.max(last.end, word.end);
    else ranges.push({ start: word.start, end: word.end });
  }
  return ranges;
}
export function deleteTranscriptWords(project: Project, trackId: string, selected: string[], newId: () => string): void {
  const words = transcriptWords(project, trackId);
  if (!selected.length || selected.some(id => !words.some(word => word.id === id))) throw new Error('Select words from the current transcript');
  for (const range of transcriptRanges(words, selected).reverse()) cutTimelineRange(project, range.start, range.end, newId);
}
