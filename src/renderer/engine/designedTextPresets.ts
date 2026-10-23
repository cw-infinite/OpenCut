import type { TextAnimation, TextClip, TextStyle } from '../../shared/types';
import { defaultTextStyle } from './text';
const motion = (preset: string, duration: number, granularity: TextAnimation['granularity'] = 'whole', stagger = 0): TextAnimation => ({ preset, duration, granularity, stagger, easing: { bezier: [.22, 1, .36, 1] } });
export const designedTextPresets: { name: string; purpose: string; description: string; sample: string; style: Partial<TextStyle>; animIn: TextAnimation; animOut: TextAnimation; animLoop?: TextAnimation }[] = [
  { name: 'Editorial reveal', purpose: 'Documentary / opening title', description: 'Lines rise through a fixed mask with a clean, staggered finish.', sample: 'A DIFFERENT\nPERSPECTIVE', style: { fontFamily: 'Montserrat', weight: 800, fontSize: 96, lineHeight: 1.05, letterSpacing: -2 }, animIn: motion('maskRise', 800000, 'line', 140000), animOut: motion('fade', 240000) },
  { name: 'Creator captions', purpose: 'Reels / explainers', description: 'Compact word-by-word focus, with readable contrast and no bounce.', sample: 'Make every word count', style: { fontFamily: 'Poppins', weight: 800, fontSize: 78, stroke: { color: '#111318', width: 3 }, shadow: { color: '#000000', blur: 10, offsetX: 0, offsetY: 3 } }, animIn: motion('focusLift', 320000, 'word', 85000), animOut: motion('fade', 180000) },
  { name: 'Studio identifier', purpose: 'Interview / lower third', description: 'A restrained horizontal reveal with warm neutral typography.', sample: 'JORDAN LEE\nCreative Director', style: { fontFamily: 'Inter', weight: 600, fontSize: 62, align: 'left', color: '#f2eee7', lineHeight: 1.4, background: { color: '#141b24', opacity: .92, paddingX: 28, paddingY: 18, radius: 4 } }, animIn: motion('slideReveal', 700000, 'line', 110000), animOut: motion('fade', 220000) },
  { name: 'Product focus', purpose: 'Product / brand launch', description: 'Spaced typography resolves into focus for a polished product reveal.', sample: 'LESS. BUT BETTER.', style: { fontFamily: 'Montserrat', weight: 500, fontSize: 84, letterSpacing: 5, color: '#e8f0ff' }, animIn: motion('trackingIn', 1100000), animOut: motion('fade', 350000) },
  { name: 'Campaign punch', purpose: 'Promo / sports / announcement', description: 'A short, precise scale accent, followed by a steady readable hold.', sample: 'MAKE IT\nHAPPEN.', style: { fontFamily: 'Anton', fontSize: 118, color: '#daff60', lineHeight: 1.02, letterSpacing: -1 }, animIn: motion('impactIn', 280000, 'line', 80000), animOut: motion('fade', 160000) },
  { name: 'Quiet statement', purpose: 'Travel / fashion / quotation', description: 'A subtle line drift with soft focus and generous pacing.', sample: 'Some moments\nstay with you.', style: { fontFamily: 'Playfair Display', weight: 400, fontSize: 88, color: '#f5eede', lineHeight: 1.2 }, animIn: motion('editorialDrift', 1000000, 'line', 160000), animOut: motion('fade', 450000) }
];
export function applyDesignedTextPreset(clip: TextClip, preset: typeof designedTextPresets[number]): void {
  clip.style = structuredClone({ ...defaultTextStyle, ...preset.style });
  clip.animIn = structuredClone(preset.animIn); clip.animOut = structuredClone(preset.animOut);
  if (preset.animLoop) clip.animLoop = structuredClone(preset.animLoop); else delete clip.animLoop;
  // Keep a readable hold even when the selected clip or wording is short/long.
  for (const key of ['animIn', 'animOut'] as const) {
    const animation = clip[key]!;
    const count = animation.granularity === 'line' ? clip.content.split('\n').length : animation.granularity === 'word' ? clip.content.trim().split(/\s+/).length : animation.granularity === 'char' ? Array.from(clip.content).length : 1;
    const total = animation.duration + Math.max(0, count - 1) * animation.stagger;
    const factor = Math.min(1, clip.duration * (key === 'animIn' ? .45 : .2) / total);
    animation.duration = Math.max(10000, Math.round(animation.duration * factor)); animation.stagger = Math.round(animation.stagger * factor);
  }
  if (clip.caption) clip.caption.preset = 'plain';
}
