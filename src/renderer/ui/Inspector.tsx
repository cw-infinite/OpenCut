import { AudioControls } from './AudioControls';
import { SilenceRemoval } from './SilenceRemoval';
import { VisualControls } from './VisualControls';
import { DerivedActions } from './DerivedActions';
import { TextInspector } from './TextInspector';
import { TransitionEditor } from './TransitionEditor';
import { changeSpeed } from '../engine/speed';
import { KeyframeEditor } from './KeyframeEditor';
import { evaluate, setAnimatedValue } from '../engine/keyframes';
import { useEditor } from '../state/editor';
import { editable, makeTrack } from '../engine/timeline';
import type { MediaClip } from '../../shared/types';

export function Inspector(): JSX.Element {
  const state = useEditor(), project = state.project!;
  const clip = project.tracks.flatMap(track => track.clips).find(clip => clip.id === state.selected[0]);
  const edit = (fn: (clip: MediaClip) => void) => { if (clip?.type === 'media') state.edit(project => fn(editable(project, clip.id).clip as MediaClip)); };
  const time = Math.max(0, Math.min(clip?.duration ?? 0, state.playhead - (clip?.start ?? 0)));
  if (clip?.type === 'text') return <aside className="inspector"><TextInspector clip={clip}/></aside>;
  const number = (label: string, value: number, onChange: (value: number) => void, min: number, max: number, step = .01) => <label className="inspector-number">{label}<input aria-label={label} type="number" value={value} min={min} max={max} step={step} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= min && value <= max) onChange(value); }}/></label>;
  return <aside className="inspector"><div className="panel-heading"><h2>Inspector</h2><span>{state.selected.length ? `${state.selected.length} selected` : 'Nothing selected'}</span></div>{!clip || clip.type !== 'media' ? <p className="subtle">Select a clip to adjust its appearance and sound.</p> : <><h3>Transform</h3><div className="inspector-fields">{number('Position X', evaluate(clip.transform.x, time), value => edit(clip => { setAnimatedValue(clip.transform.x, time, value); }), -2, 3)}{number('Position Y', evaluate(clip.transform.y, time), value => edit(clip => { setAnimatedValue(clip.transform.y, time, value); }), -2, 3)}{number('Scale', evaluate(clip.transform.scale, time), value => edit(clip => { setAnimatedValue(clip.transform.scale, time, value); }), .01, 10)}{number('Rotation', evaluate(clip.transform.rotation, time), value => edit(clip => { setAnimatedValue(clip.transform.rotation, time, value); }), -360, 360, 1)}{number('Opacity', evaluate(clip.opacity, time), value => edit(clip => { setAnimatedValue(clip.opacity, time, value); }), 0, 1)}</div>
      <label className="inspector-number">Fit mode<select value={clip.fit} onChange={event => edit(clip => { clip.fit = event.target.value as MediaClip['fit']; })}><option value="fit">Fit</option><option value="fill">Fill</option><option value="stretch">Stretch</option></select></label>
      <label className="check-row"><input type="checkbox" checked={clip.blurBackground} onChange={event => edit(clip => { clip.blurBackground = event.target.checked; })}/> Blurred background</label>
      <div className="inspector-fields">{(['l', 't', 'r', 'b'] as const).map(side => number(`Crop ${side}`, clip.crop[side], value => edit(clip => { clip.crop[side] = value; }), 0, .49))}</div>
      <div className="inspector-buttons">{(['x', 'y'] as const).map(axis => <button key={axis} className="secondary" onClick={() => edit(clip => { let flip = clip.effects.find(effect => effect.type === 'flip'); if (!flip) { flip = { type: 'flip', params: { x: 0, y: 0 }, enabled: true }; clip.effects.push(flip); } flip.params[axis] = flip.params[axis] ? 0 : 1; })}>Flip {axis.toUpperCase()}</button>)}</div>
      <VisualControls clip={clip}/><h3>Speed</h3>{project.media[clip.mediaId].kind !== 'image' && number('Playback speed', clip.speed, value => state.edit(project => changeSpeed(project, clip.id, value)), .1, 100, .01)}<p className="subtle">Speed changes ripple later clips on this track and linked audio. Export preserves audio pitch.</p><DerivedActions clip={clip}/><TransitionEditor clip={clip}/><KeyframeEditor clip={clip}/><AudioControls clip={clip}/>{project.media[clip.mediaId].hasAudio && <SilenceRemoval key={clip.id} clip={clip}/>}<h3>Audio</h3>{number('Volume', evaluate(clip.volume, time), value => edit(clip => { setAnimatedValue(clip.volume, time, value); }), 0, 4)}<label className="check-row"><input type="checkbox" checked={clip.muted} onChange={event => edit(clip => { clip.muted = event.target.checked; })}/> Mute clip</label>
      <button className="secondary" disabled={!project.media[clip.mediaId].hasAudio} onClick={() => state.edit(project => {
        const original = editable(project, clip.id).clip as MediaClip;
        const track = makeTrack(crypto.randomUUID(), 'audio', 'Detached audio');
        const audio: MediaClip = JSON.parse(JSON.stringify(original)); audio.id = crypto.randomUUID(); audio.trackId = track.id; audio.muted = false;
        original.linkId = audio.linkId = crypto.randomUUID(); original.muted = true; track.clips.push(audio); project.tracks.push(track);
      })}>Detach audio</button>
      <div className="inspector-buttons"><button className="secondary" disabled={state.selected.length < 2} onClick={() => state.edit(project => { const link = crypto.randomUUID(); for (const id of state.selected) editable(project, id).clip.linkId = link; })}>Link</button><button className="secondary" onClick={() => state.edit(project => { const link = clip.linkId; for (const track of project.tracks) for (const item of track.clips) if (link && item.linkId === link) delete item.linkId; })}>Unlink</button></div>
    </>}</aside>;
}
