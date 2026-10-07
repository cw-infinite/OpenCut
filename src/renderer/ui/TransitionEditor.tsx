import type { Clip, Transition } from '../../shared/types';
import { useEditor } from '../state/editor';
import { applyDefaultTransitions, applyTransition, transitionTypes } from '../engine/transitions';

export function TransitionEditor({ clip }: { clip: Clip }): JSX.Element {
  const state = useEditor(), track = state.project!.tracks.find(track => track.id === clip.trackId)!;
  if (track.kind !== 'video') return <></>;
  const type = clip.transitionIn?.type ?? 'none', duration = clip.transitionIn?.duration ?? 500000;
  return <section><h3>Transition into clip</h3>
    <label className="inspector-number">Transition<select aria-label="Transition type" value={type} onChange={event => state.edit(project => applyTransition(project, clip.id, event.target.value as Transition['type'] | 'none', duration))}>
      <option value="none">None</option>{transitionTypes.map(name => <option key={name} value={name}>{name.replace(/([A-Z])/g, ' $1')}</option>)}
    </select></label>
    <label className="inspector-number">Seconds<input aria-label="Transition duration" type="number" min="0.001" step="0.1" value={duration / 1e6} disabled={type === 'none'} onChange={event => state.edit(project => applyTransition(project, clip.id, type, Math.round(Number(event.target.value) * 1e6)))}/></label>
    <button className="secondary" onClick={() => state.edit(applyDefaultTransitions)}>Dissolve all adjacent cuts</button>
    <p className="subtle">Transitions overlap adjacent clips and shorten this track. Drag the transition edge on the timeline to set its duration.</p>
  </section>;
}
