import type { TextClip, TextStyle } from '../../shared/types';
import { constant } from './timeline';

export const bundledFonts = ['Inter', 'Roboto', 'Montserrat', 'Poppins', 'Oswald', 'Anton', 'Bebas Neue', 'Lobster', 'Pacifico', 'Permanent Marker', 'Playfair Display', 'Roboto Mono'];
export const defaultTextStyle: TextStyle = { fontFamily: 'Inter', fontSize: 80, weight: 700, italic: false, color: '#ffffff', align: 'center', lineHeight: 1.2, letterSpacing: 0, maxWidthFraction: .8 };
export const textStyles: Record<string, Partial<TextStyle>> = {
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
