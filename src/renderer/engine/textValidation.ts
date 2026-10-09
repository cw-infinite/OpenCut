import type { TextClip, TextStyle } from '../../shared/types';
import { loopPresets, textPresets } from './textAnimations';

const numeric = (value: number, min: number, max: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('Invalid text style number');
};
const color = (value: string) => { if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) throw new Error('Invalid text color'); };
export function validateTextStyle(style: TextStyle): void {
  if (!style || typeof style.fontFamily !== 'string' || !style.fontFamily.trim() || style.fontFamily.length > 200) throw new Error('Invalid font family');
  numeric(style.fontSize, 6, 500); numeric(style.lineHeight, .5, 3); numeric(style.letterSpacing, -10, 50); numeric(style.maxWidthFraction, .1, 1);
  if (![400, 500, 600, 700, 800, 900].includes(style.weight) || !['left', 'center', 'right'].includes(style.align) || typeof style.italic !== 'boolean') throw new Error('Invalid typography');
  color(style.color);
  if (style.stroke) { color(style.stroke.color); numeric(style.stroke.width, 0, 30); }
  if (style.shadow) { color(style.shadow.color); numeric(style.shadow.blur, 0, 100); numeric(style.shadow.offsetX, -100, 100); numeric(style.shadow.offsetY, -100, 100); }
  if (style.glow) { color(style.glow.color); numeric(style.glow.blur, 0, 100); }
  if (style.background) { const b = style.background; color(b.color); numeric(b.opacity, 0, 1); numeric(b.paddingX, 0, 100); numeric(b.paddingY, 0, 100); numeric(b.radius, 0, 100); }
  if (style.gradient) { color(style.gradient.from); color(style.gradient.to); numeric(style.gradient.angle, -360, 360); }
}
export function validateText(clip: TextClip): void {
  if (clip.caption && (!Array.isArray(clip.caption.words) || clip.caption.words.some(word => typeof word.text !== 'string' || !Number.isSafeInteger(word.start) || !Number.isSafeInteger(word.end) || word.end <= word.start))) throw new Error('Invalid caption word timing');
  if (clip.caption?.preset && !['plain', 'karaoke', 'wordPop', 'box', 'outline'].includes(clip.caption.preset)) throw new Error('Invalid caption preset');
  if (typeof clip.content !== 'string' || clip.content.length > 20000) throw new Error('Text must be at most 20,000 characters');
  validateTextStyle(clip.style);
  for (const key of ['animIn', 'animOut', 'animLoop'] as const) {
    const animation = clip[key]; if (!animation) continue;
    const presets: readonly string[] = key === 'animLoop' ? loopPresets : textPresets;
    if (!presets.includes(animation.preset) || !['whole', 'line', 'word', 'char'].includes(animation.granularity)) throw new Error('Invalid text animation');
    if (!Number.isSafeInteger(animation.duration) || animation.duration < 10000 || animation.duration > 60e6 || !Number.isSafeInteger(animation.stagger) || animation.stagger < 0 || animation.stagger > 10e6) throw new Error('Invalid text animation timing');
    if (typeof animation.easing === 'string') { if (!['linear', 'easeIn', 'easeOut', 'easeInOut', 'hold'].includes(animation.easing)) throw new Error('Invalid text animation easing'); }
    else { if (!Array.isArray(animation.easing?.bezier) || animation.easing.bezier.length !== 4) throw new Error('Invalid text Bezier easing'); animation.easing.bezier.forEach(point => numeric(point, 0, 1)); }
  }
}
