import type { Clip, Project } from '../../shared/types';
import { shiftAnimation } from './keyframes';
import { quantizeOffset } from './speed';

/** Remove one time interval from every track, retaining source and animation timing. */
export function cutTimelineRange(project: Project, start: number, end: number, newId: () => string): void {
  if (![start, end].every(Number.isSafeInteger) || start < 0 || end <= start) throw new Error('Invalid cut range');
  for (const track of project.tracks) {
    if (track.locked && track.clips.some(clip => clip.start + clip.duration > start)) throw new Error('Unlock affected tracks before cutting across the timeline');
    for (const clip of track.clips) {
      if (clip.transitionIn && start < clip.start + clip.transitionIn.duration && end > clip.start) throw new Error('Remove the transition crossing this cut first');
      for (const boundary of [start, end]) if (boundary > clip.start && boundary < clip.start + clip.duration && quantizeOffset(clip, boundary - clip.start) !== boundary - clip.start) throw new Error('This cut falls between source timing units at the current speed');
    }
  }
  const links = new Map<string, string>(), length = end - start;
  const captionContent = (clip: Clip) => {
    if (clip.type !== 'text' || !clip.caption?.words.length) return true;
    clip.caption.words = clip.caption.words.filter(word => word.start < clip.duration && word.end > 0).map(word => ({ ...word, start: Math.max(0, word.start), end: Math.min(clip.duration, word.end) }));
    clip.content = clip.caption.words.map(word => word.text).join(' '); return Boolean(clip.content);
  };
  for (const track of project.tracks) {
    const result: Clip[] = [];
    for (const clip of track.clips) {
      const oldEnd = clip.start + clip.duration;
      if (oldEnd <= start) { result.push(clip); continue; }
      if (clip.start >= end) { clip.start -= length; result.push(clip); continue; }
      if (clip.start < start) {
        const left: Clip = JSON.parse(JSON.stringify(clip)); left.duration = start - clip.start;
        if (left.type === 'media') {
          if (left.reverse) left.sourceIn = left.sourceOut - Math.round(left.duration * left.speed);
          else left.sourceOut = left.sourceIn + Math.round(left.duration * left.speed);
          left.fadeIn = Math.min(left.fadeIn, left.duration); left.fadeOut = Math.min(left.fadeOut, left.duration);
        }
        if (captionContent(left)) result.push(left);
      }
      if (oldEnd > end) {
        const right: Clip = JSON.parse(JSON.stringify(clip)), offset = end - clip.start;
        right.id = clip.start < start ? newId() : clip.id; right.start = start; right.duration = oldEnd - end;
        delete right.transitionIn; shiftAnimation(right, offset);
        if (right.linkId) { if (!links.has(right.linkId)) links.set(right.linkId, newId()); right.linkId = links.get(right.linkId); }
        if (right.type === 'media') {
          if (right.reverse) right.sourceOut -= Math.round(offset * right.speed); else right.sourceIn += Math.round(offset * right.speed);
          right.fadeIn = Math.min(right.fadeIn, right.duration); right.fadeOut = Math.min(right.fadeOut, right.duration);
        }
        if (captionContent(right)) result.push(right);
      }
    }
    track.clips = result;
  }
  project.markers = project.markers.filter(marker => marker.time < start || marker.time >= end).map(marker => ({ ...marker, time: marker.time >= end ? marker.time - length : marker.time }));
}
export function fillerCandidates(project: Project) {
  const found = new Map<string, { text: string; start: number; end: number }>();
  for (const track of project.tracks) for (const clip of track.clips) if (clip.type === 'text' && clip.caption) {
    for (const word of clip.caption.words) if (/^(um|uh)$/i.test(word.text.replace(/^[^a-z]+|[^a-z]+$/gi, ''))) {
      const start = Math.max(clip.start, clip.start + word.start), end = Math.min(clip.start + clip.duration, clip.start + word.end);
      if (end > start) found.set(`${start}:${end}`, { text: word.text, start, end });
    }
  }
  return [...found.values()].sort((a, b) => a.start - b.start);
}
