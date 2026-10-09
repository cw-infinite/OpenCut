import type { Project } from '../../shared/types';
import { editable, endOf, validateTimeline } from './timeline';

/** Move a selection atomically: no sequential collision checks or repeated linked moves. */
export function moveSelection(project: Project, ids: string[], delta: number, trackDelta = 0): void {
  const selected = ids.map(id => editable(project, id));
  delta = Math.max(-Math.min(...selected.map(item => item.clip.start)), Math.round(delta));
  const moves = selected.map(({ clip, track }) => {
    const target = project.tracks[project.tracks.indexOf(track) + trackDelta];
    if (!target || target.locked || target.kind !== track.kind) throw new Error('Choose unlocked tracks of the same kind');
    return { clip, target };
  });
  for (const track of project.tracks) track.clips = track.clips.filter(clip => !ids.includes(clip.id));
  for (const { clip, target } of moves) { clip.start += delta; clip.trackId = target.id; target.clips.push(clip); }
  for (const track of project.tracks) track.clips.sort((a, b) => a.start - b.start);
  validateTimeline(project);
}

export function duplicateSelection(project: Project, ids: string[], newId: () => string): string[] {
  const originals = ids.map(id => editable(project, id).clip);
  if (!originals.length) return [];
  const start = Math.min(...originals.map(clip => clip.start)), end = Math.max(...originals.map(endOf)), span = end - start;
  const tracks = new Set(originals.map(clip => clip.trackId)), links = new Map<string, string>(), copies: string[] = [];
  for (const track of project.tracks) if (tracks.has(track.id)) for (const clip of track.clips) {
    if (clip.start < end && endOf(clip) > end) throw new Error('A clip crosses the end of this selection; split it before duplicating here');
    if (clip.start >= end) clip.start += span;
  }
  for (const original of originals) {
    const clip = JSON.parse(JSON.stringify(original)) as typeof original;
    clip.id = newId(); clip.start += span;
    if (clip.linkId) { if (!links.has(clip.linkId)) links.set(clip.linkId, newId()); clip.linkId = links.get(clip.linkId); }
    // A transition into an unselected predecessor cannot be copied independently.
    const track = project.tracks.find(track => track.id === clip.trackId)!;
    const predecessor = track.clips[track.clips.findIndex(item => item.id === original.id) - 1];
    if (!predecessor || !ids.includes(predecessor.id)) delete clip.transitionIn;
    track.clips.push(clip); copies.push(clip.id);
  }
  for (const track of project.tracks) track.clips.sort((a, b) => a.start - b.start);
  validateTimeline(project); return copies;
}
