import type { TextClip, TextStyle } from '../../shared/types';
import { constant } from './timeline';

export const bundledFonts = ['Inter', 'Roboto', 'Montserrat', 'Poppins', 'Oswald', 'Anton', 'Bebas Neue', 'Lobster', 'Pacifico', 'Permanent Marker', 'Playfair Display', 'Roboto Mono'];
export const defaultTextStyle: TextStyle = { fontFamily: 'Inter', fontSize: 80, weight: 700, italic: false, color: '#ffffff', align: 'center', lineHeight: 1.2, letterSpacing: 0, maxWidthFraction: .8 };
export const textStyles: Record<string, Partial<TextStyle>> = {
  'Cinema gold': { fontFamily: 'Bebas Neue', fontSize: 110, color: '#f7cf75', letterSpacing: 5, shadow: { color: '#000000', blur: 12, offsetX: 0, offsetY: 4 } },
  'Editorial serif': { fontFamily: 'Playfair Display', fontSize: 92, weight: 400, color: '#fff0dc' },
  'Retro sunset': { fontFamily: 'Lobster', fontSize: 90, gradient: { from: '#ffcf70', to: '#ef487f', angle: 90 }, stroke: { color: '#40214d', width: 3 } },
  'Tech mono': { fontFamily: 'Roboto Mono', fontSize: 62, color: '#72eaff', letterSpacing: 3 },
  'Soft script': { fontFamily: 'Pacifico', fontSize: 76, weight: 400, color: '#ffc2df' },
  'Sports headline': { fontFamily: 'Anton', fontSize: 110, italic: true, color: '#ffe14a', stroke: { color: '#101820', width: 4 } },
  'News banner': { fontFamily: 'Oswald', fontSize: 60, align: 'left', background: { color: '#b52032', opacity: 1, paddingX: 28, paddingY: 14, radius: 0 } },
  'Minimal label': { fontFamily: 'Inter', fontSize: 42, weight: 500, letterSpacing: 4, background: { color: '#15181d', opacity: .75, paddingX: 18, paddingY: 10, radius: 20 } },
  'Electric blue': { fontFamily: 'Montserrat', fontSize: 90, weight: 900, color: '#88bfff', glow: { color: '#337bff', blur: 22 } },
  'Paper note': { fontFamily: 'Permanent Marker', fontSize: 64, color: '#29241b', background: { color: '#ffedac', opacity: 1, paddingX: 26, paddingY: 20, radius: 3 } },
  'Bold title': { fontFamily: 'Montserrat', fontSize: 100, weight: 800 },
  'Lower third': { fontSize: 48, align: 'left', background: { color: '#15181d', opacity: .9, paddingX: 24, paddingY: 16, radius: 8 } },
  Quote: { fontFamily: 'Playfair Display', fontSize: 70, italic: true, weight: 400 },
  Subtitle: { fontSize: 48, weight: 700, stroke: { color: '#000000', width: 3 } },
  Neon: { fontFamily: 'Poppins', color: '#baff72', glow: { color: '#8dff32', blur: 18 } },
  Comic: { fontFamily: 'Permanent Marker', color: '#ffe66d', stroke: { color: '#161616', width: 4 } },
  Outline: { fontFamily: 'Anton', color: '#ffffff', stroke: { color: '#14171d', width: 6 } }
};
export function makeTextClip(id: string, trackId: string, start: number): TextClip {
  return { id, trackId, type: 'text', content: 'Your story starts here', start, duration: 5e6,
    transform: { x: constant(.5), y: constant(.5), scale: constant(1), rotation: constant(0) }, opacity: constant(1), effects: [], style: { ...defaultTextStyle } };
}
export function fontString(style: TextStyle, scale: number): string {
  return `${style.italic ? 'italic ' : ''}${style.weight} ${style.fontSize * scale}px "${style.fontFamily.replace(/["\\]/g, '')}"`;
}
