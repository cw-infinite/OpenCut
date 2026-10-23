import type { TextClip, TextStyle } from '../../shared/types';
import { constant } from './timeline';

export const bundledFonts = ['Inter', 'Roboto', 'Montserrat', 'Poppins', 'Oswald', 'Anton', 'Bebas Neue', 'Lobster', 'Pacifico', 'Permanent Marker', 'Playfair Display', 'Roboto Mono'];
export const defaultTextStyle: TextStyle = { transparentFill: false, fontFamily: 'Inter', fontSize: 80, weight: 700, italic: false, color: '#ffffff', align: 'center', lineHeight: 1.2, letterSpacing: 0, maxWidthFraction: .8 };
export const textStyles: Record<string, Partial<TextStyle>> = {
  'Soft script': { fontFamily: 'Pacifico', fontSize: 76, weight: 400, color: '#ffc2df' },
  'Sports headline': { fontFamily: 'Anton', fontSize: 110, italic: true, color: '#ffe14a', stroke: { color: '#101820', width: 4 } },
  'Bold title': { fontFamily: 'Montserrat', fontSize: 100, weight: 800 },
  Outline: { fontFamily: 'Anton', color: '#ffffff', stroke: { color: '#14171d', width: 6 } }
};
export function makeTextClip(id: string, trackId: string, start: number): TextClip {
  return { id, trackId, type: 'text', content: 'Your story starts here', start, duration: 5e6,
    transform: { x: constant(.5), y: constant(.5), scale: constant(1), rotation: constant(0) }, opacity: constant(1), effects: [], style: { ...defaultTextStyle } };
}
export function fontString(style: TextStyle, scale: number): string {
  return `${style.italic ? 'italic ' : ''}${style.weight} ${style.fontSize * scale}px "${style.fontFamily.replace(/["\\]/g, '')}"`;
}
