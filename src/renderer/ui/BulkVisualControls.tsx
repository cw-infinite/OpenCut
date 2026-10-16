import type { MediaClip } from '../../shared/types';
import { useEditor } from '../state/editor';
import { commonValue } from '../engine/bulkText';
import { editMediaSelection } from '../engine/bulkMedia';
import { filterPresets, visualEffects } from '../engine/visualEffects';

export function BulkVisualControls({ clips }: { clips: MediaClip[] }): JSX.Element {
  const state = useEditor();
  const edit = (change: (clip: MediaClip) => void) => state.edit(project => editMediaSelection(project, clips.map(clip => clip.id), change));
  const read = <T,>(get: (clip: MediaClip) => T) => commonValue(clips.map(get));
  const number = (label: string, get: (clip: MediaClip) => number | undefined, change: (clip: MediaClip, value: number) => void, min = 0, max = 1) => <label className="inspector-number">{label}<input aria-label={`Selection ${label.toLowerCase()}`} type="number" min={min} max={max} step={.05} placeholder="Mixed" value={read(get) ?? ''} onChange={event => { if (!event.target.value) return; const value = Number(event.target.value); if (Number.isFinite(value) && value >= min && value <= max) edit(clip => change(clip, value)); }}/></label>;
  const filter = read(clip => clip.filter?.preset ?? '');
  return <section className="media-inspector-section"><h3>Color & visual effects</h3><p className="subtle">Applies to all selected video and image clips. Mixed values stay unchanged until you edit them.</p>
    <label className="inspector-number">Filter preset<select aria-label="Selection filter preset" value={filter ?? 'mixed'} onChange={event => edit(clip => { clip.filter = event.target.value ? { preset: event.target.value, intensity: 1 } : undefined; })}><option value="mixed" disabled>Mixed</option><option value="">None</option>{filterPresets.map(name => <option key={name}>{name}</option>)}</select></label>
    {clips.some(clip => clip.filter) && number('Filter intensity', clip => clip.filter?.intensity, (clip, value) => { if (clip.filter) clip.filter.intensity = value; })}
    {(['brightness', 'contrast', 'saturation', 'temperature', 'vignette', 'sharpen'] as const).map(name => <div key={name}>{number(name[0].toUpperCase() + name.slice(1), clip => clip.adjust[name], (clip, value) => { clip.adjust[name] = value; }, ['vignette', 'sharpen'].includes(name) ? 0 : -1)}</div>)}
    <h3>Video effects</h3>{Object.entries(visualEffects).map(([type, label]) => {
      const enabled = read(clip => Boolean(clip.effects.find(effect => effect.type === type)?.enabled));
      return <div key={type}><label className="check-row"><input aria-label={`Selection ${label.toLowerCase()}`} type="checkbox" checked={enabled === true} ref={element => { if (element) element.indeterminate = enabled === undefined; }} onChange={event => edit(clip => { const found = clip.effects.find(effect => effect.type === type); if (found) found.enabled = event.target.checked; else clip.effects.push({ type, enabled: event.target.checked, params: { amount: .5 } }); })}/>{label}{enabled === undefined && <span className="mixed-value"> · Mixed</span>}</label>
        {clips.some(clip => clip.effects.some(effect => effect.type === type && effect.enabled)) && type !== 'mirror' && number(`${label} strength`, clip => { const effect = clip.effects.find(effect => effect.type === type && effect.enabled); return effect ? Number(effect.params.amount) : undefined; }, (clip, value) => { let effect = clip.effects.find(effect => effect.type === type); if (!effect) { effect = { type, enabled: true, params: {} }; clip.effects.push(effect); } effect.enabled = true; effect.params.amount = value; })}</div>;
    })}
  </section>;
}
