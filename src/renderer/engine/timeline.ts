import { quantizeOffset } from './speed';
import { shiftAnimation } from './keyframes';
import type { Project, Clip, MediaClip, MediaAsset, Track, Animatable } from '../../shared/types';
import { validateClipValues, validateTrackValues } from './validation';
export const constant = (value: number): Animatable<number> => ({ value, keyframes: [] });
export const endOf = (clip: Clip) => clip.start + clip.duration;
export const durationOf = (project: Project) => Math.max(0, ...project.tracks.flatMap(track => track.clips.map(endOf)));
export function makeTrack(id: string, kind: Track['kind'], name: string): Track { return { id, kind, name, locked: false, hidden: false, muted: false, clips: [] }; }
export function makeMediaClip(id: string, asset: MediaAsset, trackId: string, start: number): MediaClip {
  if (asset.status !== 'ready') throw new Error('Wait for media import to finish');
  return { id, trackId, start: Math.round(start), duration: asset.duration, type: 'media', mediaId: asset.id,
    sourceIn: 0, sourceOut: asset.duration, speed: 1, reverse: false, volume: constant(1), fadeIn: 0, fadeOut: 0, muted: false,
    fit: 'fit', blurBackground: false, crop: { l: 0, t: 0, r: 0, b: 0 },
    adjust: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, vignette: 0, sharpen: 0 },
    transform: { x: constant(.5), y: constant(.5), scale: constant(1), rotation: constant(0) }, opacity: constant(1), effects: [] };
}
export function validateTimeline(project: Project): void {
  validateTrackValues(project);
  const ids = new Set<string>();
  for (const track of project.tracks) {
    if (ids.has(track.id)) throw new Error('Duplicate track ID'); ids.add(track.id);
    let previous: Clip | undefined;
    for (const clip of track.clips) {
      validateClipValues(clip);
      if (ids.has(clip.id)) throw new Error('Duplicate clip ID'); ids.add(clip.id);
      if (clip.trackId !== track.id || !Number.isSafeInteger(clip.start) || clip.start < 0 || !Number.isSafeInteger(clip.duration) || clip.duration <= 0) throw new Error('Invalid clip timing');
      if (previous && clip.start < endOf(previous) - (clip.transitionIn?.duration ?? 0)) throw new Error('Clips cannot overlap on the same track');
      if (clip.transitionIn && (!previous || clip.start !== endOf(previous) - clip.transitionIn.duration || clip.transitionIn.duration + (previous.transitionIn?.duration ?? 0) > previous.duration)) throw new Error('Transition requires an exact overlap without a third clip');
      if (clip.type === 'text' && track.kind !== 'text') throw new Error('Use a text track');
      if (clip.type === 'media') {
        const asset = project.media[clip.mediaId];
        if (!asset || asset.status !== 'ready') throw new Error('Missing or unprepared media');
        if (track.kind === 'text' || (track.kind === 'video' && asset.kind === 'audio') || (track.kind === 'audio' && !asset.hasAudio)) throw new Error('This media does not belong on that track');
        if (![clip.sourceIn, clip.sourceOut].every(Number.isSafeInteger) || clip.sourceIn < 0 || clip.sourceOut > asset.duration || clip.speed < .1 || clip.speed > 100 || Math.abs(clip.sourceOut - clip.sourceIn - clip.duration * clip.speed) > .00001) throw new Error('Invalid source trim or speed');
      }
      previous = clip;
    }
  }
}
export function findClip(project: Project, id: string): { clip: Clip; track: Track } {
  for (const track of project.tracks) { const clip = track.clips.find(clip => clip.id === id); if (clip) return { clip, track }; }
  throw new Error('Clip no longer exists');
}
export function editable(project: Project, id: string) {
  const found = findClip(project, id); if (found.track.locked) throw new Error('Track is locked'); return found;
}
export function splitClip(project: Project, id: string, at: number, newId: string, newLinkId?: string): void {
  const { clip, track } = editable(project, id);
  const offset = quantizeOffset(clip, at - clip.start);
  if (offset <= 0 || offset >= clip.duration) return;
  const right: Clip = JSON.parse(JSON.stringify(clip));
  right.id = newId; right.start = clip.start + offset; right.duration -= offset;
  if (right.linkId) right.linkId = newLinkId;
  delete right.transitionIn;
  shiftAnimation(right, offset);
  if (clip.type === 'media' && right.type === 'media') {
    if (clip.reverse) { right.sourceOut = clip.sourceOut - Math.round(offset * clip.speed); clip.sourceIn = right.sourceOut; }
    else { right.sourceIn = clip.sourceIn + Math.round(offset * clip.speed); clip.sourceOut = right.sourceIn; }
  }
  clip.duration = offset;
  track.clips.push(right); track.clips.sort((a, b) => a.start - b.start);
}
export function moveClip(project: Project, id: string, trackId: string, start: number): void {
  const { clip, track } = editable(project, id), target = project.tracks.find(track => track.id === trackId);
  if (!target || target.locked || target.kind !== track.kind) throw new Error('Choose an unlocked track of the same kind');
  const delta = Math.max(0, Math.round(start)) - clip.start;
  if (clip.linkId) for (const linkedTrack of project.tracks) {
    for (const partner of linkedTrack.clips) if (partner.id !== clip.id && partner.linkId === clip.linkId) {
      if (linkedTrack.locked) throw new Error('Linked track is locked'); partner.start += delta;
    }
    linkedTrack.clips.sort((a, b) => a.start - b.start);
  }
  track.clips = track.clips.filter(item => item.id !== id); clip.trackId = target.id; clip.start = Math.max(0, Math.round(start));
  target.clips.push(clip); target.clips.sort((a, b) => a.start - b.start);
}
export function trimClip(project: Project, id: string, edge: 'start' | 'end', time: number, propagate = true): void {
  const { clip, track } = editable(project, id);
  const origin = edge === 'start' ? clip.start : endOf(clip);
  time = origin + quantizeOffset(clip, time - origin);
  if (propagate && clip.linkId) {
    const delta = time - (edge === 'start' ? clip.start : endOf(clip));
    for (const lane of project.tracks) for (const partner of lane.clips) if (partner.id !== id && partner.linkId === clip.linkId) {
      trimClip(project, partner.id, edge, (edge === 'start' ? partner.start : endOf(partner)) + delta, false);
    }
  }
  if (edge === 'start') {
    const delta = time - clip.start;
    clip.start = time; clip.duration -= delta;
    shiftAnimation(clip, delta);
    if (clip.type === 'media') { if (clip.reverse) clip.sourceOut -= Math.round(delta * clip.speed); else clip.sourceIn += Math.round(delta * clip.speed); }
  } else {
    const delta = time - endOf(clip); clip.duration += delta;
    if (clip.type === 'media') { if (clip.reverse) clip.sourceIn -= Math.round(delta * clip.speed); else clip.sourceOut += Math.round(delta * clip.speed); }
  }
  track.clips.sort((a, b) => a.start - b.start);
}
export function deleteClips(project: Project, ids: string[], ripple = false): void {
  const links = project.tracks.flatMap(track => track.clips.filter(clip => ids.includes(clip.id) && clip.linkId).map(clip => clip.linkId));
  ids = [...ids, ...project.tracks.flatMap(track => track.clips.filter(clip => clip.linkId && links.includes(clip.linkId)).map(clip => clip.id))];
  for (const track of project.tracks) {
    const removed = track.clips.filter(clip => ids.includes(clip.id));
    if (removed.length && track.locked) throw new Error('Track is locked');
    track.clips = track.clips.filter(clip => !ids.includes(clip.id));
    if (ripple) for (const clip of track.clips) clip.start -= removed.filter(item => endOf(item) <= clip.start).reduce((total, item) => total + item.duration, 0);
  }
}
export function snapTime(time: number, candidates: number[], threshold: number): number {
  let best = Math.max(0, Math.round(time)), distance = threshold;
  for (const candidate of candidates) if (candidate >= 0 && Math.abs(candidate - time) <= distance) { best = candidate; distance = Math.abs(candidate - time); }
  return Math.round(best);
}
