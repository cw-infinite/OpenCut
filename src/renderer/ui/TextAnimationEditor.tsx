import type { TextAnimation, TextClip } from '../../shared/types';
import { loopPresets, textPresets } from '../engine/textAnimations';

export function TextAnimationEditor({ clip, edit }: { clip: TextClip; edit(fn: (clip: TextClip) => void): void }): JSX.Element {
  return <section><h3>Text animations</h3>{(['animIn', 'animOut', 'animLoop'] as const).map(key => {
    const animation = clip[key];
    const update = (fn: (animation: TextAnimation) => void) => edit(clip => { if (clip[key]) fn(clip[key]!); });
    return <div key={key} className="text-animation-controls"><label className="inspector-number">{key === 'animIn' ? 'In' : key === 'animOut' ? 'Out' : 'Loop'}<select aria-label={`${key} preset`} value={animation?.preset ?? ''} onChange={event => edit(clip => {
      if (!event.target.value) delete clip[key]; else clip[key] = { preset: event.target.value, duration: key === 'animLoop' ? 2e6 : 500000, easing: 'easeOut', granularity: 'whole', stagger: 50000 };
    })}><option value="">None</option>{(key === 'animLoop' ? loopPresets : textPresets).map(preset => <option key={preset}>{preset}</option>)}</select></label>
    {animation && <div className="inspector-fields">
      <label>Duration (s)<input aria-label={`${key} duration`} type="number" min="0.01" max="60" step="0.1" value={animation.duration / 1e6} onChange={event => update(value => { value.duration = Math.round(Number(event.target.value) * 1e6); })}/></label>
      <label>Stagger (s)<input aria-label={`${key} stagger`} type="number" min="0" max="10" step="0.01" value={animation.stagger / 1e6} onChange={event => update(value => { value.stagger = Math.round(Number(event.target.value) * 1e6); })}/></label>
      <label>Animate<select aria-label={`${key} granularity`} value={animation.granularity} onChange={event => update(value => { value.granularity = event.target.value as TextAnimation['granularity']; })}>{['whole', 'line', 'word', 'char'].map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Easing<select aria-label={`${key} easing`} value={typeof animation.easing === 'string' ? animation.easing : 'linear'} onChange={event => update(value => { value.easing = event.target.value as TextAnimation['easing']; })}>{['linear', 'easeIn', 'easeOut', 'easeInOut', 'hold'].map(item => <option key={item}>{item}</option>)}</select></label>
    </div>}</div>;
  })}</section>;
}
