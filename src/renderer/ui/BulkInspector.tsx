import { useEditor } from '../state/editor';
import { editable } from '../engine/timeline';
import { evaluate, setAnimatedValue } from '../engine/keyframes';
import type { Clip } from '../../shared/types';

export function BulkInspector({ clips }: { clips: Clip[] }): JSX.Element {
  const state = useEditor();
  const allMedia = clips.every(clip => clip.type === 'media'), allText = clips.every(clip => clip.type === 'text');
  const values = clips.map(clip => clip.type === 'media' ? evaluate(clip.volume, Math.max(0, Math.min(clip.duration, state.playhead - clip.start))) : clip.style.fontSize);
  const same = values.every(value => value === values[0]);
  const change = (value: number) => state.edit(project => {
    for (const item of clips) {
      const { clip } = editable(project, item.id);
      if (clip.type === 'media') setAnimatedValue(clip.volume, Math.max(0, Math.min(clip.duration, state.playhead - clip.start)), value);
      else clip.style.fontSize = value;
    }
  });
  return <aside className="inspector bulk-inspector"><div className="panel-heading"><h2>{clips.length} clips selected</h2></div><p className="subtle">Drag any selected clip to move the selection together. Shift-click a clip to toggle it.</p><div className="inspector-buttons"><button className="secondary" onClick={() => state.remove()}>Delete all selected</button><button className="secondary" onClick={() => state.select([])}>Deselect all</button></div>{(allMedia || allText) && <label className="inspector-number">{allMedia ? 'Selection volume' : 'Selection font size'}<input aria-label={allMedia ? 'Selection volume' : 'Selection font size'} type="number" min={allMedia ? 0 : 8} max={allMedia ? 4 : 400} step={allMedia ? .05 : 1} placeholder="Mixed" value={same ? values[0] : ''} onChange={event => { if (!event.target.value) return; const value = Number(event.target.value); if (Number.isFinite(value) && value >= (allMedia ? 0 : 8) && value <= (allMedia ? 4 : 400)) change(value); }}/></label>}{allMedia && <label className="check-row"><input type="checkbox" aria-label="Mute selected clips" checked={clips.every(clip => clip.type === 'media' && clip.muted)} ref={element => { if (element) element.indeterminate = clips.some(clip => clip.type === 'media' && clip.muted) && !clips.every(clip => clip.type === 'media' && clip.muted); }} onChange={event => state.edit(project => { for (const item of clips) { const { clip } = editable(project, item.id); if (clip.type === 'media') clip.muted = event.target.checked; } })}/>Mute selected clips</label>}</aside>;
}
