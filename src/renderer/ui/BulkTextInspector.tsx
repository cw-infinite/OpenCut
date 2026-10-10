import { useEffect, useState } from 'react';
import type { TextClip, TextStyle } from '../../shared/types';
import { useEditor } from '../state/editor';
import { commonValue, editTextStyles } from '../engine/bulkText';
import { bundledFonts, defaultTextStyle, textStyles } from '../engine/text';

const stroke = { color: '#000000', width: 3 };
const shadow = { color: '#000000', blur: 6, offsetX: 3, offsetY: 3 };
const glow = { color: '#baff72', blur: 15 };
const background = { color: '#101113', opacity: .8, paddingX: 20, paddingY: 12, radius: 8 };
const gradient = { from: '#ffffff', to: '#baff72', angle: 90 };

export function BulkTextInspector({ clips }: { clips: TextClip[] }): JSX.Element {
  const state = useEditor(), [fonts, setFonts] = useState(bundledFonts);
  useEffect(() => { let alive = true; void window.opencut.fonts().then(system => { if (alive) setFonts([...new Set([...bundledFonts, ...system])]); }).catch(() => {}); return () => { alive = false; }; }, []);
  const read = <T,>(get: (style: TextStyle) => T) => commonValue(clips.map(clip => get(clip.style)));
  const edit = (change: (style: TextStyle) => void) => state.edit(project => editTextStyles(project, clips.map(clip => clip.id), change));
  const number = (name: string, get: (style: TextStyle) => number | undefined, set: (style: TextStyle, value: number) => void, min: number, max: number, step = 1) => <label className="inspector-number">{name}<input aria-label={`Selection ${name.toLowerCase()}`} type="number" min={min} max={max} step={step} placeholder="Mixed" value={read(get) ?? ''} onChange={event => { if (!event.target.value) return; const value = Number(event.target.value); if (Number.isFinite(value) && value >= min && value <= max) edit(style => set(style, value)); }}/></label>;
  const color = (name: string, get: (style: TextStyle) => string | undefined, set: (style: TextStyle, value: string) => void) => {
    const value = read(get);
    return <label className="inspector-number">{name}{value === undefined && <span className="mixed-value"> · Mixed</span>}<input aria-label={`Selection ${name.toLowerCase()}`} type="color" value={value ?? '#000000'} onChange={event => edit(style => set(style, event.target.value))}/></label>;
  };
  const check = (name: string, get: (style: TextStyle) => boolean, set: (style: TextStyle, value: boolean) => void) => {
    const value = read(get);
    return <label className="check-row"><input aria-label={`Selection ${name.toLowerCase()}`} type="checkbox" checked={value === true} ref={element => { if (element) element.indeterminate = value === undefined; }} onChange={event => edit(style => set(style, event.target.checked))}/>{name}{value === undefined && <span className="mixed-value"> · Mixed</span>}</label>;
  };
  const select = (name: string, value: string | number | undefined, options: (string | number)[], set: (style: TextStyle, value: string) => void) => <label className="inspector-number">{name}<select aria-label={`Selection ${name.toLowerCase()}`} value={value ?? ''} onChange={event => { if (event.target.value) edit(style => set(style, event.target.value)); }}><option value="" disabled>Mixed</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>;
  const any = (key: 'stroke' | 'shadow' | 'glow' | 'background' | 'gradient') => clips.some(clip => clip.style[key]);
  return <section className="bulk-text-controls"><h3>Text & caption style</h3><p className="subtle">Changes apply to every selected text clip. Mixed values stay unchanged until you edit that property. Wording and caption timing are preserved.</p>
    <label className="inspector-number">Style preset<select aria-label="Selection style preset" value="" onChange={event => {
      const preset = textStyles[event.target.value] ?? state.project!.captionStyles[event.target.value];
      if (preset) edit(style => { for (const key of ['stroke', 'shadow', 'glow', 'background', 'gradient'] as const) delete style[key]; Object.assign(style, structuredClone({ ...defaultTextStyle, ...preset })); });
    }}><option value="">Choose a style for all</option>{[...new Set([...Object.keys(textStyles), ...Object.keys(state.project!.captionStyles)])].map(name => <option key={name}>{name}</option>)}</select></label>
    {select('Font family', read(style => style.fontFamily), [...new Set([...fonts, ...clips.map(clip => clip.style.fontFamily)])], (style, value) => { style.fontFamily = value; })}
    <div className="inspector-fields">
      {number('Font size', style => style.fontSize, (style, value) => { style.fontSize = value; }, 6, 500)}
      {select('Font weight', read(style => style.weight), [400, 500, 600, 700, 800, 900], (style, value) => { style.weight = Number(value) as TextStyle['weight']; })}
      {color('Text color', style => style.color, (style, value) => { style.color = value; })}
      {check('Italic', style => style.italic, (style, value) => { style.italic = value; })}
      {select('Alignment', read(style => style.align), ['left', 'center', 'right'], (style, value) => { style.align = value as TextStyle['align']; })}
      {number('Line height', style => style.lineHeight, (style, value) => { style.lineHeight = value; }, .5, 3, .1)}
      {number('Letter spacing', style => style.letterSpacing, (style, value) => { style.letterSpacing = value; }, -10, 50, .5)}
      {number('Wrap width', style => style.maxWidthFraction, (style, value) => { style.maxWidthFraction = value; }, .1, 1, .05)}
    </div>
    <details open><summary>Border / outline</summary>{check('Text border', style => Boolean(style.stroke), (style, enabled) => { if (enabled) style.stroke ??= { ...stroke }; else delete style.stroke; })}
      {any('stroke') && <div className="inspector-fields">{color('Border color', style => style.stroke?.color, (style, value) => { (style.stroke ??= { ...stroke }).color = value; })}{number('Border width', style => style.stroke?.width, (style, value) => { (style.stroke ??= { ...stroke }).width = value; }, 0, 30)}</div>}
    </details>
    <details><summary>Shadow & glow</summary>{check('Text shadow', style => Boolean(style.shadow), (style, enabled) => { if (enabled) style.shadow ??= { ...shadow }; else delete style.shadow; })}
      {any('shadow') && <div className="inspector-fields">{color('Shadow color', style => style.shadow?.color, (style, value) => { (style.shadow ??= { ...shadow }).color = value; })}{number('Shadow blur', style => style.shadow?.blur, (style, value) => { (style.shadow ??= { ...shadow }).blur = value; }, 0, 100)}{number('Shadow X', style => style.shadow?.offsetX, (style, value) => { (style.shadow ??= { ...shadow }).offsetX = value; }, -100, 100)}{number('Shadow Y', style => style.shadow?.offsetY, (style, value) => { (style.shadow ??= { ...shadow }).offsetY = value; }, -100, 100)}</div>}
      {check('Text glow', style => Boolean(style.glow), (style, enabled) => { if (enabled) style.glow ??= { ...glow }; else delete style.glow; })}
      {any('glow') && <div className="inspector-fields">{color('Glow color', style => style.glow?.color, (style, value) => { (style.glow ??= { ...glow }).color = value; })}{number('Glow blur', style => style.glow?.blur, (style, value) => { (style.glow ??= { ...glow }).blur = value; }, 0, 100)}</div>}
    </details>
    <details><summary>Background & gradient</summary>{check('Text background', style => Boolean(style.background), (style, enabled) => { if (enabled) style.background ??= { ...background }; else delete style.background; })}
      {any('background') && <div className="inspector-fields">{color('Background color', style => style.background?.color, (style, value) => { (style.background ??= { ...background }).color = value; })}{number('Background opacity', style => style.background?.opacity, (style, value) => { (style.background ??= { ...background }).opacity = value; }, 0, 1, .05)}{number('Padding X', style => style.background?.paddingX, (style, value) => { (style.background ??= { ...background }).paddingX = value; }, 0, 100)}{number('Padding Y', style => style.background?.paddingY, (style, value) => { (style.background ??= { ...background }).paddingY = value; }, 0, 100)}{number('Corner radius', style => style.background?.radius, (style, value) => { (style.background ??= { ...background }).radius = value; }, 0, 100)}</div>}
      {check('Text gradient', style => Boolean(style.gradient), (style, enabled) => { if (enabled) style.gradient ??= { ...gradient }; else delete style.gradient; })}
      {any('gradient') && <div className="inspector-fields">{color('Gradient from', style => style.gradient?.from, (style, value) => { (style.gradient ??= { ...gradient }).from = value; })}{color('Gradient to', style => style.gradient?.to, (style, value) => { (style.gradient ??= { ...gradient }).to = value; })}{number('Gradient angle', style => style.gradient?.angle, (style, value) => { (style.gradient ??= { ...gradient }).angle = value; }, -360, 360)}</div>}
    </details>
  </section>;
}
