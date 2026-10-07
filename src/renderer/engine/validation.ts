import { validateText } from './textValidation';
import type { Animatable, Clip, Project } from '../../shared/types';
import { transitionTypes } from './transitions';
function number(value: unknown, min: number, max: number, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${label}`);
}
function animated(value: Animatable<number>, min: number, max: number, label: string): void {
  if (!value || !Array.isArray(value.keyframes)) throw new Error(`Invalid ${label}`);
  number(value.value, min, max, label);
  let previous = -Infinity;
  for (const key of value.keyframes) {
    if (!Number.isSafeInteger(key.time) || key.time <= previous) throw new Error(`Invalid ${label} keyframe time`);
    number(key.value, min, max, label); previous = key.time;
    if (typeof key.easing === 'string') {
      if (!['linear', 'easeIn', 'easeOut', 'easeInOut', 'hold'].includes(key.easing)) throw new Error('Invalid easing');
    } else {
      const points = key.easing?.bezier;
      if (!Array.isArray(points) || points.length !== 4) throw new Error('Invalid Bezier easing');
      points.forEach(point => number(point, 0, 1, 'Bezier control point'));
    }
  }
}
export function validateClipValues(clip: Clip): void {
  if (!clip || !['media', 'text'].includes(clip.type) || !clip.transform || !Array.isArray(clip.effects)) throw new Error('Invalid clip data');
  animated(clip.opacity, 0, 1, 'opacity');
  animated(clip.transform.x, -100, 100, 'position'); animated(clip.transform.y, -100, 100, 'position');
  animated(clip.transform.scale, .001, 100, 'scale'); animated(clip.transform.rotation, -36000, 36000, 'rotation');
  if (clip.transitionIn && (!transitionTypes.includes(clip.transitionIn.type) || !Number.isSafeInteger(clip.transitionIn.duration) || clip.transitionIn.duration <= 0 || clip.transitionIn.duration > clip.duration)) throw new Error('Invalid transition duration');
  if (clip.type === 'text') validateText(clip);
  if (clip.type === 'media') {
    animated(clip.volume, 0, 4, 'volume'); number(clip.speed, .1, 100, 'speed');
    if (![clip.fadeIn, clip.fadeOut].every(time => Number.isSafeInteger(time) && time >= 0)) throw new Error('Invalid audio fade');
    for (const side of ['l', 'r', 't', 'b'] as const) number(clip.crop?.[side], 0, .999, 'crop');
    if (clip.crop.l + clip.crop.r >= 1 || clip.crop.t + clip.crop.b >= 1) throw new Error('Crop must leave a visible image');
    if (!['fit', 'fill', 'stretch'].includes(clip.fit)) throw new Error('Invalid fit mode');
  }
}
export function validateTrackValues(project: Project): void {
  if (!Array.isArray(project.tracks) || !Array.isArray(project.markers)) throw new Error('Invalid timeline data');
  for (const track of project.tracks) if (!track || !['video', 'audio', 'text'].includes(track.kind) || !Array.isArray(track.clips) || typeof track.name !== 'string') throw new Error('Invalid track data');
  for (const marker of project.markers) if (!Number.isSafeInteger(marker.time) || marker.time < 0 || typeof marker.label !== 'string') throw new Error('Invalid marker');
}
