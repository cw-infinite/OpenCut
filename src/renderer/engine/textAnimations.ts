import type { TextAnimation } from '../../shared/types';
import { ease } from './keyframes';

export const textPresets = ['fade', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'pop', 'zoomIn', 'typewriter', 'bounce', 'blurIn', 'rotateIn', 'wipe'] as const;
export const loopPresets = ['pulse', 'wiggle', 'float', 'shake', 'flicker', 'colorCycle'] as const;
export interface TextMotion { dx: number; dy: number; scale: number; rotation: number; opacity: number; blur: number; reveal: number; hue: number }
const identity = (): TextMotion => ({ dx: 0, dy: 0, scale: 1, rotation: 0, opacity: 1, blur: 0, reveal: 1, hue: 0 });
export function textMotion(preset: string, progress: number, loop = false): TextMotion {
  const p = Math.max(0, Math.min(1, progress)), motion = identity(), wave = Math.sin(p * Math.PI * 2);
  if (loop) {
    if (preset === 'pulse') motion.scale = 1 + .07 * wave;
    if (preset === 'wiggle') motion.rotation = wave * 5;
    if (preset === 'float') motion.dy = wave * 15;
    if (preset === 'shake') { motion.dx = Math.sin(p * Math.PI * 14) * 5; motion.dy = Math.sin(p * Math.PI * 22) * 3; }
    if (preset === 'flicker') motion.opacity = .65 + .35 * Math.abs(Math.cos(p * Math.PI * 6));
    if (preset === 'colorCycle') motion.hue = p * 360;
    return motion;
  }
  motion.opacity = p;
  if (preset === 'slideUp') motion.dy = (1 - p) * 80;
  if (preset === 'slideDown') motion.dy = -(1 - p) * 80;
  if (preset === 'slideLeft') motion.dx = (1 - p) * 100;
  if (preset === 'slideRight') motion.dx = -(1 - p) * 100;
  if (preset === 'zoomIn') motion.scale = .25 + .75 * p;
  if (preset === 'pop') motion.scale = 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2;
  if (preset === 'bounce') motion.dy = -(1 - p) * Math.abs(Math.cos(p * Math.PI * 3)) * 100;
  if (preset === 'blurIn') motion.blur = (1 - p) * 20;
  if (preset === 'rotateIn') { motion.rotation = (1 - p) * -45; motion.scale = .5 + p * .5; }
  if (preset === 'typewriter' || preset === 'wipe') { motion.opacity = 1; motion.reveal = p; }
  return motion;
}
export function animationAt(animation: TextAnimation | undefined, time: number, duration: number, index: number, count: number, phase: 'in' | 'out' | 'loop'): TextMotion {
  if (!animation) return identity();
  const stagger = index * animation.stagger;
  let p: number;
  if (phase === 'loop') p = (((time - stagger) % animation.duration) + animation.duration) % animation.duration / animation.duration;
  else if (phase === 'in') p = (time - stagger) / animation.duration;
  else p = (duration - time - (count - 1 - index) * animation.stagger) / animation.duration;
  return textMotion(animation.preset, ease(Math.max(0, Math.min(1, p)), animation.easing), phase === 'loop');
}
