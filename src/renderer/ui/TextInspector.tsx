import { useEffect, useState } from 'react';
import type { TextClip, TextStyle } from '../../shared/types';
import { useEditor } from '../state/editor';
import { editable } from '../engine/timeline';
import { evaluate, setAnimatedValue } from '../engine/keyframes';
import { bundledFonts, defaultTextStyle, textStyles } from '../engine/text';
import { KeyframeEditor } from './KeyframeEditor';
import { TextAnimationEditor } from './TextAnimationEditor';

export function TextInspector({ clip }: { clip: TextClip }): JSX.Element {
  const state = useEditor(), [fonts, setFonts] = useState(bundledFonts), [styleName, setStyleName] = useState('My style');
  useEffect(() => { void window.opencut.fonts().then(system => setFonts([...new Set([...bundledFonts, ...system])])).catch(() => {}); }, []);
  const edit = (fn: (clip: TextClip) => void) => state.edit(project => fn(editable(project, clip.id).clip as TextClip));
  const time = Math.max(0, Math.min(clip.duration, state.playhead - clip.start));
  const number = (label: string, value: number, change: (value: number) => void, min: number, max: number, step = 1) => <label className="inspector-number">{label}<input aria-label={label} type="number" value={value} min={min} max={max} step={step} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= min && value <= max) change(value); }}/></label>;
  const color = (label: string, value: string, change: (value: string) => void) => <label className="inspector-number">{label}<input aria-label={label} type="color" value={value} onChange={event => change(event.target.value)}/></label>;
  const style = (fn: (style: TextStyle) => void) => edit(clip => fn(clip.style));
  return <><div className="panel-heading"><h2>Text</h2><span>Title & typography</span></div>
    <textarea aria-label="Text content" className="text-content" value={clip.content} onChange={event => edit(clip => { clip.content = event.target.value; if (clip.caption) clip.caption.words = []; })}/>
    <label className="inspector-number">Style preset<select aria-label="Text style preset" value="" onChange={event => { const preset = textStyles[event.target.value] ?? state.project!.captionStyles[event.target.value]; if (preset) edit(clip => { clip.style = structuredClone({ ...defaultTextStyle, ...preset }); }); }}><option value="">Choose a style</option>{[...Object.keys(textStyles), ...Object.keys(state.project!.captionStyles)].map(name => <option key={name}>{name}</option>)}</select></label>
    <div className="inspector-fields"><input aria-label="Saved style name" value={styleName} onChange={event => setStyleName(event.target.value)}/><button className="secondary" onClick={() => { if (styleName.trim()) state.edit(project => { project.captionStyles[styleName.trim().slice(0, 80)] = structuredClone(clip.style); }); }}>Save style</button></div>
    <label className="inspector-number">Font<select aria-label="Font family" value={clip.style.fontFamily} onChange={event => style(value => { value.fontFamily = event.target.value; })}>{fonts.map(font => <option key={font}>{font}</option>)}</select></label>
    <div className="inspector-fields">{number('Font size', clip.style.fontSize, value => style(style => { style.fontSize = value; }), 6, 500)}
      <label className="inspector-number">Weight<select aria-label="Font weight" value={clip.style.weight} onChange={event => style(value => { value.weight = Number(event.target.value) as TextStyle['weight']; })}>{[400, 500, 600, 700, 800, 900].map(weight => <option key={weight}>{weight}</option>)}</select></label>
      {color('Text color', clip.style.color, value => style(style => { style.color = value; }))}
      <label className="check-row"><input type="checkbox" checked={clip.style.italic} onChange={event => style(value => { value.italic = event.target.checked; })}/> Italic</label>
      <label className="inspector-number">Alignment<select aria-label="Text alignment" value={clip.style.align} onChange={event => style(value => { value.align = event.target.value as TextStyle['align']; })}>{['left', 'center', 'right'].map(align => <option key={align}>{align}</option>)}</select></label>
      {number('Line height', clip.style.lineHeight, value => style(style => { style.lineHeight = value; }), .5, 3, .1)}
      {number('Letter spacing', clip.style.letterSpacing, value => style(style => { style.letterSpacing = value; }), -10, 50, .5)}
      {number('Wrap width', clip.style.maxWidthFraction, value => style(style => { style.maxWidthFraction = value; }), .1, 1, .05)}
    </div><h3>Appearance</h3>
    {(['stroke', 'shadow', 'glow', 'background', 'gradient'] as const).map(key => <label className="check-row" key={key}><input aria-label={`Enable text ${key}`} type="checkbox" checked={Boolean(clip.style[key])} onChange={event => style(value => {
      if (!event.target.checked) delete value[key]; else Object.assign(value, { [key]: key === 'stroke' ? { color: '#000000', width: 3 } : key === 'shadow' ? { color: '#000000', blur: 6, offsetX: 3, offsetY: 3 } : key === 'glow' ? { color: '#baff72', blur: 15 } : key === 'background' ? { color: '#101113', opacity: .8, paddingX: 20, paddingY: 12, radius: 8 } : { from: '#ffffff', to: '#baff72', angle: 90 } });
    })}/>{key}</label>)}
    <div className="inspector-fields">
      {clip.style.stroke && <>{color('Stroke color', clip.style.stroke.color, value => style(style => { style.stroke!.color = value; }))}{number('Stroke width', clip.style.stroke.width, value => style(style => { style.stroke!.width = value; }), 0, 30)}</>}
      {clip.style.shadow && <>{color('Shadow color', clip.style.shadow.color, value => style(style => { style.shadow!.color = value; }))}{number('Shadow blur', clip.style.shadow.blur, value => style(style => { style.shadow!.blur = value; }), 0, 100)}{number('Shadow X', clip.style.shadow.offsetX, value => style(style => { style.shadow!.offsetX = value; }), -100, 100)}{number('Shadow Y', clip.style.shadow.offsetY, value => style(style => { style.shadow!.offsetY = value; }), -100, 100)}</>}
      {clip.style.glow && <>{color('Glow color', clip.style.glow.color, value => style(style => { style.glow!.color = value; }))}{number('Glow blur', clip.style.glow.blur, value => style(style => { style.glow!.blur = value; }), 0, 100)}</>}
      {clip.style.background && <>{color('Box color', clip.style.background.color, value => style(style => { style.background!.color = value; }))}{number('Box opacity', clip.style.background.opacity, value => style(style => { style.background!.opacity = value; }), 0, 1, .05)}{number('Padding X', clip.style.background.paddingX, value => style(style => { style.background!.paddingX = value; }), 0, 100)}{number('Padding Y', clip.style.background.paddingY, value => style(style => { style.background!.paddingY = value; }), 0, 100)}{number('Corner radius', clip.style.background.radius, value => style(style => { style.background!.radius = value; }), 0, 100)}</>}
      {clip.style.gradient && <>{color('Gradient from', clip.style.gradient.from, value => style(style => { style.gradient!.from = value; }))}{color('Gradient to', clip.style.gradient.to, value => style(style => { style.gradient!.to = value; }))}{number('Gradient angle', clip.style.gradient.angle, value => style(style => { style.gradient!.angle = value; }), -360, 360)}</>}
    </div><h3>Transform & timing</h3><div className="inspector-fields">
      {(['x', 'y', 'scale', 'rotation'] as const).map(name => number(`Text ${name}`, evaluate(clip.transform[name], time), value => edit(clip => setAnimatedValue(clip.transform[name], time, value)), name === 'scale' ? .01 : -360, name === 'scale' ? 10 : 360, .01))}
      {number('Text opacity', evaluate(clip.opacity, time), value => edit(clip => setAnimatedValue(clip.opacity, time, value)), 0, 1, .05)}
      {number('Text duration', clip.duration / 1e6, value => edit(clip => { clip.duration = Math.round(value * 1e6); }), .01, 3600, .1)}
    </div><TextAnimationEditor clip={clip} edit={edit}/><KeyframeEditor clip={clip}/>
  </>;
}
