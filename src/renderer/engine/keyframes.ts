import type { Animatable, Clip, Keyframe } from '../../shared/types';

export type VisualProperty = 'x' | 'y' | 'scale' | 'rotation' | 'opacity';
export function visualProperty(clip: Clip, name: VisualProperty): Animatable<number> {
  return name === 'opacity' ? clip.opacity : clip.transform[name];
}
const cubic = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
export function ease(progress: number, easing: Keyframe<number>['easing']): number {
  const t = Math.max(0, Math.min(1, progress));
  if (t === 0 || t === 1) return t;
  if (easing === 'hold') return 0;
  if (easing === 'linear') return t;
  if (easing === 'easeIn') return t * t;
  if (easing === 'easeOut') return 1 - (1 - t) ** 2;
  if (easing === 'easeInOut') return t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const [x1, y1, x2, y2] = easing.bezier;
  let low = 0, high = 1;
  for (let i = 0; i < 40; i++) {
    const middle = (low + high) / 2;
    if (cubic(middle, x1, x2) < t) low = middle; else high = middle;
  }
  return cubic((low + high) / 2, y1, y2);
}
export function evaluate(animated: Animatable<number>, time: number): number {
  const keys = animated.keyframes;
  if (!keys.length) return animated.value;
  if (time <= keys[0].time) return keys[0].value;
  let low = 0, high = keys.length;
  while (low < high) { const mid = (low + high) >>> 1; if (keys[mid].time <= time) low = mid + 1; else high = mid; }
  const left = keys[low - 1], right = keys[low];
  if (!right) return left.value;
  return left.value + (right.value - left.value) * ease((time - left.time) / (right.time - left.time), left.easing);
}
export function setAnimatedValue(animated: Animatable<number>, time: number, value: number): void {
  if (!animated.keyframes.length) { animated.value = value; return; }
  const existing = animated.keyframes.find(key => key.time === time);
  if (existing) existing.value = value;
  else { animated.keyframes.push({ time, value, easing: 'linear' }); animated.keyframes.sort((a, b) => a.time - b.time); }
}
export function addClipKeyframe(clip: Clip, time: number): void {
  time = Math.max(0, Math.min(clip.duration, Math.round(time)));
  const properties = [...(['x', 'y', 'scale', 'rotation', 'opacity'] as const).map(name => visualProperty(clip, name)), ...(clip.type === 'media' ? [clip.volume] : [])];
  for (const property of properties) if (!property.keyframes.some(key => key.time === time)) {
    const value = evaluate(property, time);
    property.keyframes.push({ time, value, easing: 'linear' }); property.keyframes.sort((a, b) => a.time - b.time);
  }
}
// Keep keys outside the trimmed range to preserve the exact interpolation curve.
export function shiftAnimation(clip: Clip, delta: number): void {
  if (clip.type === 'text' && clip.caption) for (const word of clip.caption.words) { word.start -= delta; word.end -= delta; }
  const properties = [...Object.values(clip.transform), clip.opacity, ...(clip.type === 'media' ? [clip.volume] : [])];
  for (const property of properties) for (const key of property.keyframes) key.time -= delta;
}
