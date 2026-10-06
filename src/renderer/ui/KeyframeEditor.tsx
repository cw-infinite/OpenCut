import { useState } from 'react';
import type { Clip, Keyframe } from '../../shared/types';
import { useEditor } from '../state/editor';
import { editable } from '../engine/timeline';
import { evaluate, visualProperty, type VisualProperty } from '../engine/keyframes';

export function KeyframeEditor({ clip }: { clip: Clip }): JSX.Element {
  const state = useEditor();
  const [property, setProperty] = useState<VisualProperty>('x');
  const animated = visualProperty(clip, property), time = Math.round(state.playhead - clip.start);
  const update = (fn: (value: typeof animated) => void) => state.edit(project => fn(visualProperty(editable(project, clip.id).clip, property)));
  return <section className="keyframe-editor"><h3>Animation</h3>
    <label className="inspector-number">Property<select aria-label="Animated property" value={property} onChange={event => setProperty(event.target.value as VisualProperty)}>
      <option value="x">Position X</option><option value="y">Position Y</option><option value="scale">Scale</option><option value="rotation">Rotation</option><option value="opacity">Opacity</option>
    </select></label>
    <p className="subtle">At {(time / 1e6).toFixed(3)}s: {evaluate(animated, time).toFixed(3)}. Transform fields edit the value at the playhead when animated.</p>
    <div className="inspector-buttons"><button className="secondary" disabled={time < 0 || time > clip.duration} onClick={() => update(value => {
      if (!value.keyframes.some(key => key.time === time)) { value.keyframes.push({ time, value: evaluate(value, time), easing: 'linear' }); value.keyframes.sort((a, b) => a.time - b.time); }
    })}>Add keyframe</button><button className="secondary" disabled={!animated.keyframes.length} onClick={() => update(value => { value.value = evaluate(value, time); value.keyframes = []; })}>Clear animation</button></div>
    {animated.keyframes.map(key => <div className="keyframe-row" key={key.time}>
      <input aria-label={`Keyframe time at ${key.time}`} title="Clip-relative seconds" type="number" step="0.001" defaultValue={key.time / 1e6} onBlur={event => {
        const next = Math.round(Number(event.target.value) * 1e6);
        if (!Number.isSafeInteger(next) || next < 0 || next > clip.duration || animated.keyframes.some(item => item !== key && item.time === next)) { event.target.value = String(key.time / 1e6); return; }
        update(value => { value.keyframes.find(item => item.time === key.time)!.time = next; value.keyframes.sort((a, b) => a.time - b.time); });
      }}/>
      <input aria-label={`Keyframe value at ${key.time}`} type="number" step="0.01" value={key.value} onChange={event => update(value => { value.keyframes.find(item => item.time === key.time)!.value = Number(event.target.value); })}/>
      <select aria-label={`Keyframe easing at ${key.time}`} value={typeof key.easing === 'string' ? key.easing : 'custom'} onChange={event => update(value => { value.keyframes.find(item => item.time === key.time)!.easing = event.target.value === 'custom' ? { bezier: [.42, 0, .58, 1] } : event.target.value as Keyframe<number>['easing']; })}>
        <option value="linear">Linear</option><option value="easeIn">Ease in</option><option value="easeOut">Ease out</option><option value="easeInOut">Ease in/out</option><option value="hold">Hold</option><option value="custom">Custom Bézier</option>
      </select>
      <button className="secondary" aria-label={`Remove keyframe at ${key.time}`} onClick={() => update(value => { value.keyframes = value.keyframes.filter(item => item.time !== key.time); })}>×</button>
      {typeof key.easing !== 'string' && <div className="bezier-fields">{key.easing.bezier.map((point, index) => <label key={index}>{['X1', 'Y1', 'X2', 'Y2'][index]}<input aria-label={`Bezier ${index} at ${key.time}`} type="number" min="0" max="1" step="0.05" value={point} onChange={event => update(value => {
        const easing = value.keyframes.find(item => item.time === key.time)!.easing;
        if (typeof easing !== 'string') easing.bezier[index] = Number(event.target.value);
      })}/></label>)}</div>}
    </div>)}
  </section>;
}
