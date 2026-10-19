import type { TextAnimation, TextClip, TextStyle } from '../../shared/types';
import { defaultTextStyle } from './text';
const motion = (preset: string, duration: number, granularity: TextAnimation['granularity'] = 'whole', stagger = 0): TextAnimation => ({ preset, duration, granularity, stagger, easing: 'easeOut' });
export const designedTextPresets: { name: string; description: string; style: Partial<TextStyle>; animIn: TextAnimation; animOut: TextAnimation; animLoop?: TextAnimation }[] = [
  { name: 'Neon pulse', description: 'Cyan glow with a soft rhythmic pulse', style: { fontFamily: 'Montserrat', color: '#72eaff', glow: { color: '#28baff', blur: 18 } }, animIn: motion('blurIn', 550000), animOut: motion('fade', 300000), animLoop: motion('pulse', 1800000) },
  { name: 'Cinema reveal', description: 'Gold headline rising into frame', style: { fontFamily: 'Bebas Neue', color: '#f7cf75', fontSize: 110, letterSpacing: 4 }, animIn: motion('slideUp', 800000), animOut: motion('fade', 500000) },
  { name: 'Typewriter terminal', description: 'Mint letters typed one at a time', style: { fontFamily: 'Roboto Mono', color: '#a5ffc9', fontSize: 64 }, animIn: motion('typewriter', 1000000, 'char', 18000), animOut: motion('fade', 250000) },
  { name: 'Pop headline', description: 'Bold yellow words with a playful entrance', style: { fontFamily: 'Anton', color: '#ffe14a', fontSize: 100, stroke: { color: '#151525', width: 4 } }, animIn: motion('pop', 500000, 'word', 100000), animOut: motion('slideDown', 300000) },
  { name: 'Floating script', description: 'Pink handwritten title with gentle drift', style: { fontFamily: 'Pacifico', weight: 400, color: '#ffc2df' }, animIn: motion('fade', 650000), animOut: motion('fade', 450000), animLoop: motion('float', 2800000) },
  { name: 'Outline bounce', description: 'Hollow white lettering with a bounce', style: { fontFamily: 'Montserrat', weight: 900, transparentFill: true, stroke: { color: '#ffffff', width: 3 } }, animIn: motion('bounce', 700000), animOut: motion('zoomOut', 400000) }
];
export function applyDesignedTextPreset(clip: TextClip, preset: typeof designedTextPresets[number]): void {
  clip.style = structuredClone({ ...defaultTextStyle, ...preset.style });
  clip.animIn = structuredClone(preset.animIn); clip.animOut = structuredClone(preset.animOut);
  if (preset.animLoop) clip.animLoop = structuredClone(preset.animLoop); else delete clip.animLoop;
  if (clip.caption) clip.caption.preset = 'plain';
}
