import type { Animatable, Project, Track } from '../../shared/types';
import { evaluate } from './keyframes';

export function audible(project: Project, track: Track): boolean {
  return !track.hidden && !track.muted && (!project.tracks.some(track => track.solo && !track.hidden && !track.muted) || Boolean(track.solo));
}
export function duckEnvelope(project: Project, track: Track, start = 0): Animatable<number> {
  const config = track.ducking;
  if (!config) return { value: 1, keyframes: [] };
  const intervals = project.tracks.filter(source => config.speechTrackIds.includes(source.id) && source.id !== track.id && audible(project, source))
    .flatMap(source => source.clips.filter(clip => clip.type === 'media' && !clip.muted && project.media[clip.mediaId]?.hasAudio).map(clip => [clip.start, clip.start + clip.duration]));
  const points = [...new Set(intervals.flatMap(([a, b]) => [a - config.attack, a, b, b + config.release]))].sort((a, b) => a - b);
  const gainAt = (time: number) => Math.min(1, ...intervals.map(([a, b]) => {
    if (time < a - config.attack || time > b + config.release) return 1;
    if (time < a) return 1 - (1 - config.gain) * (time - a + config.attack) / config.attack;
    if (time > b) return config.gain + (1 - config.gain) * (time - b) / config.release;
    return config.gain;
  }));
  // Include intersections between a release and the next attack to preserve the minimum envelope.
  const crossings: number[] = [];
  for (const [, end] of intervals) for (const [begin] of intervals) {
    if (end >= begin || end + config.release <= begin - config.attack) continue;
    const point = (config.release * begin + config.attack * end) / (config.attack + config.release);
    if (point > end && point < begin) crossings.push(Math.round(point));
  }
  return { value: 1, keyframes: [...new Set([...points, ...crossings])].sort((a, b) => a - b).map(time => ({ time: time - start, value: gainAt(time), easing: 'linear' })) };
}
const envelopes = new WeakMap<Project, Map<string, Animatable<number>>>();
export function duckGain(project: Project, track: Track, time: number): number {
  let cache = envelopes.get(project); if (!cache) { cache = new Map(); envelopes.set(project, cache); }
  let envelope = cache.get(track.id); if (!envelope) { envelope = duckEnvelope(project, track); cache.set(track.id, envelope); }
  return evaluate(envelope, time);
}
