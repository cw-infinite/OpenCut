import { TextPresetCard } from './TextPresetCard';
import { designedTextPresets, applyDesignedTextPreset } from '../engine/designedTextPresets';
import type { TextAnimation, TextClip } from '../../shared/types';
import { loopPresets, textPresets } from '../engine/textAnimations';

export function TextAnimationEditor({ clip, edit }: { clip: TextClip; edit(fn: (clip: TextClip) => void): void }): JSX.Element {
  return <section data-text-section="animation" className="text-inspector-section"><h3>Animated text presets</h3><p className="subtle">Hover or focus a card to preview. Click to apply typography and motion; your wording stays unchanged.</p><div className="designed-text-presets">{designedTextPresets.map(preset => <TextPresetCard key={preset.name} preset={preset} apply={() => edit(clip => applyDesignedTextPreset(clip, preset))}/>)}</div><button className="secondary" onClick={() => edit(clip => { delete clip.animIn; delete clip.animOut; delete clip.animLoop; })}>Clear animations</button><h3>Animation timing</h3>{(['animIn', 'animOut', 'animLoop'] as const).map(key => {
    const animation = clip[key];
    const update = (fn: (animation: TextAnimation) => void) => edit(clip => { if (clip[key]) fn(clip[key]!); });
    return <div key={key} className="text-animation-controls"><label className="inspector-number">{key === 'animIn' ? 'In' : key === 'animOut' ? 'Out' : 'Loop'}<select aria-label={`${key} preset`} value={animation?.preset ?? ''} onChange={event => edit(clip => {
      if (!event.target.value) delete clip[key]; else clip[key] = { preset: event.target.value, duration: key === 'animLoop' ? 2e6 : 500000, easing: 'easeOut', granularity: 'whole', stagger: 50000 };
    })}><option value="">None</option>{(key === 'animLoop' ? loopPresets : textPresets).map(preset => <option key={preset}>{preset}</option>)}</select></label>
    {animation && <div className="inspector-fields">
      <label>Duration (s)<input aria-label={`${key} duration`} type="number" min="0.01" max="60" step="0.1" value={animation.duration / 1e6} onChange={event => update(value => { value.duration = Math.round(Number(event.target.value) * 1e6); })}/></label>
      <label>Stagger (s)<input aria-label={`${key} stagger`} type="number" min="0" max="10" step="0.01" value={animation.stagger / 1e6} onChange={event => update(value => { value.stagger = Math.round(Number(event.target.value) * 1e6); })}/></label>
      <label>Animate<select aria-label={`${key} granularity`} value={animation.granularity} onChange={event => update(value => { value.granularity = event.target.value as TextAnimation['granularity']; })}>{['whole', 'line', 'word', 'char'].map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Easing<select aria-label={`${key} easing`} value={typeof animation.easing === 'string' ? animation.easing : 'custom'} onChange={event => update(value => { value.easing = event.target.value as TextAnimation['easing']; })}><option value="custom" disabled>Custom curve</option>{['linear', 'easeIn', 'easeOut', 'easeInOut', 'hold'].map(item => <option key={item}>{item}</option>)}</select></label>
    </div>}</div>;
  })}</section>;
}
