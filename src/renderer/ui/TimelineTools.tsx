import { useState } from 'react';
import { useEditor } from '../state/editor';
import { editable } from '../engine/timeline';

export function TimelineTools(): JSX.Element {
  const state = useEditor(), project = state.project!, [open, setOpen] = useState(false);
  const group = (unlink: boolean) => state.edit(project => {
    const selected = project.tracks.flatMap(track => track.clips).filter(clip => state.selected.includes(clip.id));
    const links = selected.map(clip => clip.linkId).filter(Boolean), id = crypto.randomUUID();
    for (const track of project.tracks) for (const clip of track.clips) if (state.selected.includes(clip.id) || (clip.linkId && links.includes(clip.linkId))) {
      editable(project, clip.id); if (unlink) delete clip.linkId; else clip.linkId = id;
    }
  });
  return <><button title="Group selected clips" disabled={state.selected.length < 2} onClick={() => group(false)}>Group</button><button title="Ungroup selected clips" disabled={!state.selected.length} onClick={() => group(true)}>Ungroup</button><button onClick={() => setOpen(true)}>Markers</button>{open && <div className="modal-backdrop"><section className="modal" role="dialog" aria-label="Timeline markers"><h2>Timeline markers</h2><button onClick={() => state.edit(project => { project.markers.push({ id: crypto.randomUUID(), time: state.playhead, label: 'Marker' }); })}>Add at playhead</button><div style={{ maxHeight: '55vh', overflow: 'auto' }}>{project.markers.map(marker => <div className="caption-actions" key={marker.id}><input aria-label="Marker label" value={marker.label} onChange={event => state.edit(project => { project.markers.find(item => item.id === marker.id)!.label = event.target.value; })}/><input aria-label="Marker seconds" type="number" min={0} step={.01} value={marker.time / 1e6} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= 0) state.edit(project => { project.markers.find(item => item.id === marker.id)!.time = Math.round(value * 1e6); }); }}/><button onClick={() => { state.seek(marker.time); setOpen(false); }}>Seek</button><button onClick={() => state.edit(project => { project.markers = project.markers.filter(item => item.id !== marker.id); })}>Delete</button></div>)}</div><div className="dialog-actions"><button onClick={() => setOpen(false)}>Close</button></div></section></div>}</>;
}
