import type { MediaClip } from '../../shared/types';
import { useState } from 'react';
import { useEditor } from '../state/editor';
import { editable } from '../engine/timeline';

export function AudioControls({ clip }: { clip: MediaClip }): JSX.Element {
  const state = useEditor(), project = state.project!, track = project.tracks.find(track => track.id === clip.trackId)!;
  const [analyzing, setAnalyzing] = useState(false);
  const edit = (fn: (clip: MediaClip) => void) => state.edit(project => fn(editable(project, clip.id).clip as MediaClip));
  const number = (label: string, value: number, max: number, change: (value: number) => void) => <label className="inspector-number">{label}<input aria-label={label} type="number" min="0" max={max} step="0.05" value={value} onChange={event => { const next = Number(event.target.value); if (Number.isFinite(next) && next >= 0 && next <= max) change(next); }}/></label>;
  return <section><h3>Audio mixing</h3>
    {number('Master volume', project.masterVolume ?? 1, 4, value => state.edit(project => { project.masterVolume = value; }))}
    <label className="check-row"><input aria-label="Solo selected track" type="checkbox" checked={Boolean(track.solo)} onChange={event => state.edit(project => { project.tracks.find(item => item.id === track.id)!.solo = event.target.checked; })}/>Solo this track</label>
    <div className="inspector-fields">{number('Fade in seconds', clip.fadeIn / 1e6, clip.duration / 1e6, value => edit(clip => { clip.fadeIn = Math.round(value * 1e6); }))}{number('Fade out seconds', clip.fadeOut / 1e6, clip.duration / 1e6, value => edit(clip => { clip.fadeOut = Math.round(value * 1e6); }))}</div>
    <h3>Music ducking</h3><label className="inspector-number">Speech track<select aria-label="Ducking speech track" value={track.ducking?.speechTrackIds[0] ?? ''} onChange={event => state.edit(project => {
      const target = project.tracks.find(item => item.id === track.id)!;
      if (!event.target.value) delete target.ducking; else target.ducking = { speechTrackIds: [event.target.value], gain: .25, attack: 200000, release: 500000 };
    })}><option value="">Off</option>{project.tracks.filter(item => item.id !== track.id && item.kind !== 'text').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {track.ducking && <div className="inspector-fields">{number('Ducked volume', track.ducking.gain, 1, value => state.edit(project => { project.tracks.find(item => item.id === track.id)!.ducking!.gain = value; }))}{(['attack', 'release'] as const).map(key => number(`Ducking ${key}`, track.ducking![key] / 1e6, 10, value => { if (value > 0) state.edit(project => { project.tracks.find(item => item.id === track.id)!.ducking![key] = Math.round(value * 1e6); }); }))}</div>}
    <p className="subtle">Ducking follows audible speech clips, with attack before speech and release after it.</p>
    <h3>Export audio cleanup</h3>{(['noiseReduction', 'normalize'] as const).map(key => <label className="check-row" key={key}><input aria-label={key === 'normalize' ? 'Normalize loudness' : 'Reduce audio noise'} type="checkbox" checked={Boolean(clip.audioEffects?.[key])} onChange={event => edit(clip => { clip.audioEffects = { ...clip.audioEffects, [key]: event.target.checked }; })}/>{key === 'normalize' ? 'Normalize to −16 LUFS' : 'Reduce steady noise'}</label>)}
    <p className="subtle">Cleanup is applied during export. Preview plays the original audio.</p>
    <button className="secondary" disabled={analyzing || !project.media[clip.mediaId]?.hasAudio} onClick={async () => {
      setAnalyzing(true);
      try {
        await window.opencut.projects.saveEdit(useEditor.getState().project!);
        const times = await window.opencut.media.beats(project.id, clip.id);
        if (useEditor.getState().project?.id === project.id) state.edit(project => { for (const time of times) if (!project.markers.some(marker => Math.abs(marker.time - time) < 10000)) project.markers.push({ id: crypto.randomUUID(), time, label: 'Beat' }); });
      } catch (error) { useEditor.setState({ error: String(error) }); } finally { setAnalyzing(false); }
    }}>{analyzing ? 'Analyzing beats…' : 'Detect beat markers'}</button><p className="subtle">Detected onsets become timeline markers. Enable snapping to align cuts to them.</p>
  </section>;
}
