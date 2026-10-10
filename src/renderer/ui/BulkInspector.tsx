import { BulkTextInspector } from './BulkTextInspector';
import { useEditor } from '../state/editor';
import { editable } from '../engine/timeline';
import { evaluate, setAnimatedValue } from '../engine/keyframes';
import type { Clip } from '../../shared/types';

export function BulkInspector({ clips }: { clips: Clip[] }): JSX.Element {
  const state = useEditor();
  const allMedia = clips.every(clip => clip.type === 'media'), allText = clips.every(clip => clip.type === 'text');
  const values = clips.map(clip => clip.type === 'media' ? evaluate(clip.volume, Math.max(0, Math.min(clip.duration, state.playhead - clip.start))) : 0);
  const same = values.every(value => value === values[0]);
  const change = (value: number) => state.edit(project => {
    for (const item of clips) {
      const { clip } = editable(project, item.id);
      if (clip.type === 'media') setAnimatedValue(clip.volume, Math.max(0, Math.min(clip.duration, state.playhead - clip.start)), value);
    }
  });
  return <aside className="inspector bulk-inspector"><div className="panel-heading"><h2>{clips.length} clips selected</h2></div><p className="subtle">Drag any selected clip to move the selection together. Shift-click a clip to toggle it.</p><div className="inspector-buttons"><button className="secondary" onClick={() => state.remove()}>Delete all selected</button><button className="secondary" onClick={() => state.select([])}>Deselect all</button></div>{allMedia && <label className="inspector-number">Selection volume<input aria-label="Selection volume" type="number" min={0} max={4} step={.05} placeholder="Mixed" value={same ? values[0] : ''} onChange={event => { if (!event.target.value) return; const value = Number(event.target.value); if (Number.isFinite(value) && value >= 0 && value <= 4) change(value); }}/></label>}{allMedia && <label className="check-row"><input type="checkbox" aria-label="Mute selected clips" checked={clips.every(clip => clip.type === 'media' && clip.muted)} ref={element => { if (element) element.indeterminate = clips.some(clip => clip.type === 'media' && clip.muted) && !clips.every(clip => clip.type === 'media' && clip.muted); }} onChange={event => state.edit(project => { for (const item of clips) { const { clip } = editable(project, item.id); if (clip.type === 'media') clip.muted = event.target.checked; } })}/>Mute selected clips</label>}{allText && <BulkTextInspector clips={clips.filter(clip => clip.type === 'text')}/>}</aside>;
}
