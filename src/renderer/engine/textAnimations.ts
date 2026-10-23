import type { TextAnimation } from '../../shared/types';
import { ease } from './keyframes';

export const textPresets = ['fade', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'pop', 'zoomIn', 'typewriter', 'bounce', 'blurIn', 'rotateIn', 'wipe', 'zoomOut', 'spinIn', 'riseSpin', 'dropSpin', 'swingIn', 'elastic', 'driftUpLeft', 'driftUpRight', 'driftDownLeft', 'driftDownRight', 'spiral', 'blurZoom', 'rubberBand', 'maskRise', 'focusLift', 'trackingIn', 'impactIn', 'slideReveal', 'editorialDrift'] as const;
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
  if (preset === 'zoomOut') motion.scale = 2 - p;
  if (preset === 'spinIn') { motion.rotation = -360 * (1 - p); motion.scale = .2 + .8 * p; }
  if (preset === 'riseSpin') { motion.rotation = -90 * (1 - p); motion.dy = 120 * (1 - p); }
  if (preset === 'dropSpin') { motion.rotation = 90 * (1 - p); motion.dy = -120 * (1 - p); }
  if (preset === 'swingIn') motion.rotation = Math.sin(p * Math.PI * 3) * 35 * (1 - p);
  if (preset === 'elastic') motion.scale = 1 - Math.cos(p * Math.PI * 4) * (1 - p);
  if (preset.startsWith('drift')) {
    motion.dx = (preset.endsWith('Left') ? 1 : -1) * 120 * (1 - p);
    motion.dy = (preset.includes('Up') ? 1 : -1) * 80 * (1 - p);
  }
  if (preset === 'spiral') { motion.dx = Math.cos(p * Math.PI * 4) * 100 * (1 - p); motion.dy = Math.sin(p * Math.PI * 4) * 100 * (1 - p); motion.rotation = 180 * (1 - p); }
  if (preset === 'blurZoom') { motion.blur = 25 * (1 - p); motion.scale = 1.5 - .5 * p; }
  if (preset === 'rubberBand') motion.scale = 1 + Math.sin(p * Math.PI * 4) * .4 * (1 - p);
  if (preset === 'maskRise') { motion.opacity = 1; motion.reveal = p; }
  if (preset === 'focusLift') { motion.dy = 26 * (1 - p); motion.scale = .97 + .03 * p; motion.blur = 10 * (1 - p); }
  if (preset === 'trackingIn') { motion.blur = 6 * (1 - p); motion.reveal = p; }
  if (preset === 'impactIn') { motion.scale = .88 + .12 * p + .018 * Math.sin(p * Math.PI); motion.blur = 5 * (1 - p); }
  if (preset === 'slideReveal') { motion.opacity = 1; motion.reveal = p; }
  if (preset === 'editorialDrift') { motion.dx = -22 * (1 - p); motion.blur = 3 * (1 - p); }
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

export interface MotionTemplate { name: string; category: 'Title' | 'Words'; animIn: TextAnimation; animOut: TextAnimation; animLoop?: TextAnimation }
const motionNames = ['Soft fade', 'Rise', 'Drop', 'From right', 'From left', 'Pop', 'Grow', 'Type on', 'Bounce', 'Focus', 'Rotate', 'Reveal', 'Zoom back', 'Full spin', 'Rise & turn', 'Drop & turn', 'Swing', 'Elastic', 'Diagonal northwest', 'Diagonal northeast', 'Diagonal southwest', 'Diagonal southeast', 'Spiral', 'Focus & zoom', 'Rubber band'];
export const motionTemplates: MotionTemplate[] = textPresets.slice(0, 25).flatMap((preset, index) => (['whole', 'word'] as const).map(granularity => ({
  name: `${motionNames[index]} ${granularity === 'whole' ? 'title' : 'words'}`,
  category: granularity === 'whole' ? 'Title' as const : 'Words' as const,
  animIn: { preset, duration: 700000, easing: 'easeOut', granularity, stagger: granularity === 'word' ? 90000 : 0 },
  animOut: { preset: index % 2 ? 'fade' : 'slideDown', duration: 400000, easing: 'easeIn', granularity, stagger: granularity === 'word' ? 40000 : 0 },
  ...(index % 5 === 0 ? { animLoop: { preset: index % 2 ? 'float' : 'pulse', duration: 2400000, easing: 'linear' as const, granularity: 'whole' as const, stagger: 0 } } : {})
})));
