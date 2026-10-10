import type { Project } from '../../shared/types';
import { editable } from './timeline';
import { evaluate } from './keyframes';

export interface TrackingPoint { time: number; x: number; y: number }
export interface TrackingFrame { width: number; height: number; data: Uint8ClampedArray }
export function templateTracker(frame: TrackingFrame, x: number, y: number, radius = 8) {
  const template: number[] = [];
  x = Math.round(x); y = Math.round(y);
  if (x < radius || y < radius || x >= frame.width - radius || y >= frame.height - radius) throw new Error('Choose a subject farther from the frame edge.');
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const at = ((y + dy) * frame.width + x + dx) * 4;
    template.push(frame.data[at], frame.data[at + 1], frame.data[at + 2]);
  }
  const means = [0, 0, 0]; template.forEach((n, i) => { means[i % 3] += n / (template.length / 3); });
  if (template.reduce((sum, n, i) => sum + (n - means[i % 3]) ** 2, 0) / template.length < 100) throw new Error('Choose a detailed feature or an edge, rather than a flat area.');
  return (next: TrackingFrame, search = 20) => {
    if (next.width !== frame.width || next.height !== frame.height) throw new Error('Tracking frame dimensions changed.');
    let best = Infinity, bx = x, by = y;
    for (let cy = Math.max(radius, y - search); cy <= Math.min(next.height - radius - 1, y + search); cy++) {
      for (let cx = Math.max(radius, x - search); cx <= Math.min(next.width - radius - 1, x + search); cx++) {
        let error = 0, i = 0;
        for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
          const at = ((cy + dy) * next.width + cx + dx) * 4;
          for (let c = 0; c < 3; c++) error += Math.abs(next.data[at + c] - template[i++]);
        }
        const score = error / template.length + Math.hypot(cx - x, cy - y) * .01;
        if (score < best) { best = score; bx = cx; by = cy; }
      }
    }
    if (best > 35) throw new Error('Subject lost. Choose a clearer feature or split the video into shorter sections.');
    x = bx; y = by; return { x, y };
  };
}

export function applyTracking(project: Project, sourceId: string, targetId: string, points: TrackingPoint[]): void {
  const source = editable(project, sourceId).clip, { clip: target, track } = editable(project, targetId);
  if (source.type !== 'media' || project.media[source.mediaId].kind !== 'video') throw new Error('Choose a video source.');
  if (sourceId === targetId || track.kind === 'audio' || (target.type === 'media' && project.media[target.mediaId].kind !== 'image')) throw new Error('Choose a text or image overlay.');
  if (points.length < 2 || points[0].time !== source.start || points.at(-1)!.time !== source.start + source.duration - 1 || points.some((p, i) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || (i > 0 && p.time <= points[i - 1].time))) throw new Error('Track the complete source clip before applying.');
  if (target.start > source.start || target.start + target.duration < source.start + source.duration) throw new Error('The overlay must cover the entire source clip.');
  const start = source.start - target.start, end = source.start + source.duration - target.start;
  for (const axis of ['x', 'y'] as const) {
    const property = target.transform[axis], origin = evaluate(property, start);
    const keys = points.map(point => ({ time: point.time - target.start, value: origin + point[axis] - points[0][axis], easing: 'linear' as const }));
    if (keys.some(key => key.value < -2 || key.value > 3)) throw new Error('Tracked movement is outside the supported canvas range.');
    // Preserve animation outside the tracked interval, including its boundary values.
    const before = start > 0 ? [{ time: start - 1, value: evaluate(property, start - 1), easing: 'linear' as const }] : [];
    const after = end < target.duration ? [{ time: end, value: evaluate(property, end), easing: 'linear' as const }] : [];
    property.keyframes = [...property.keyframes.filter(key => key.time < start - 1), ...before, ...keys, ...after, ...property.keyframes.filter(key => key.time > end)];
  }
}
