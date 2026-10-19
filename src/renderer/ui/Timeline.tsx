import { useTimelineDrop } from './useTimelineDrop';
import { useTimelineGesture } from './useTimelineGesture';
import { FadeHandles } from './FadeHandles';
import { TimelineTools } from './TimelineTools';
import { addClipKeyframe } from '../engine/keyframes';
import { TransitionHandle } from './TransitionHandle';
import { KeyframeMarkers } from './KeyframeMarkers';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Volume2, VolumeX, Scissors, Trash2, Undo2, Redo2, Magnet, ChevronUp, ChevronDown } from 'lucide-react';
import { useEditor } from '../state/editor';
import { useProjects } from '../state/projects';
import { durationOf, editable, endOf, snapTime, trimClip, validateTimeline, closeTimelineGaps, closeTrackGaps } from '../engine/timeline';
import { frameTime, toFrame, timecode } from '../engine/time';
import { fileName, Waveform } from './MediaBrowser';
import { produce } from 'immer';
import type { Clip } from '../../shared/types';

export function Timeline(): JSX.Element {
  const state = useEditor(), project = state.dragPreview ?? state.project!;
  const views = useProjects(state => state.views), scroller = useRef<HTMLDivElement>(null);
  const [gapScope, setGapScope] = useState('auto');
  const selectedTrack = state.project!.tracks.find(track => track.clips.some(clip => state.selected.includes(clip.id)));
  const gapTrack = selectedTrack ?? state.project!.tracks.find(track => track.kind === 'video' && track.clips.length) ?? state.project!.tracks.find(track => track.clips.length);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const duration = Math.max(10_000_000, durationOf(project) + 3_000_000), scale = state.zoom / 1e6;
  const gesture = useTimelineGesture(scroller, scale);
  const drop = useTimelineDrop(scale);
  const width = Math.max(800, duration * scale);
  const scrubCleanup = useRef<() => void>(() => {});
  useEffect(() => () => scrubCleanup.current(), []);
  const scrub = (event: React.PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('.timeline-marker')) return;
    event.preventDefault(); event.stopPropagation(); scrubCleanup.current();
    (document.activeElement as HTMLElement | null)?.blur();
    const node = event.currentTarget, pointer = event.pointerId;
    node.setPointerCapture(pointer);
    useEditor.setState({ playing: false, sourcePreview: null });
    let x = event.clientX, raf = 0;
    const update = () => {
      const scroll = scroller.current!, rect = scroll.getBoundingClientRect();
      if (x > rect.right - 20) scroll.scrollLeft += 12;
      else if (x < rect.left + 185) scroll.scrollLeft -= 12;
      const ruler = scroll.querySelector<HTMLElement>('.ruler')!;
      const time = Math.max(0, Math.min(duration, (x - ruler.getBoundingClientRect().left) / scale));
      const next = frameTime(toFrame(time, project.settings.fps), project.settings.fps);
      if (next !== useEditor.getState().playhead) state.seek(next);
    };
    const tick = () => { update(); raf = requestAnimationFrame(tick); };
    const move = (e: PointerEvent) => { if (e.pointerId === pointer) x = e.clientX; };
    const stop = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', stop);
      node.removeEventListener('lostpointercapture', stop);
      if (node.hasPointerCapture(pointer)) node.releasePointerCapture(pointer);
      scrubCleanup.current = () => {};
    };
    const up = (e: PointerEvent) => { if (e.pointerId === pointer) { x = e.clientX; update(); stop(); } };
    const cancel = (e: PointerEvent) => { if (e.pointerId === pointer) stop(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel); window.addEventListener('blur', stop);
    node.addEventListener('lostpointercapture', stop); scrubCleanup.current = stop;
    update(); raf = requestAnimationFrame(tick);
  };
  const snapped = (time: number, excluded?: string) => state.snap ? snapTime(time, [state.playhead, ...project.markers.map(marker => marker.time), ...project.tracks.flatMap(track => track.clips.filter(clip => clip.id !== excluded).flatMap(clip => [clip.start, endOf(clip)]))], 8 / scale) : time;
  const ghost = (key: string) => drop.hint?.key === key ? <div className="drop-ghost" style={{ left: drop.hint.start * scale, width: Math.max(40, drop.hint.duration * scale) }}>{drop.hint.newTrack ? 'New track' : 'Add clip'} · {(drop.hint.start / 1e6).toFixed(2)}s</div> : null;
  const zone = (index: number, bottom = false) => <div className={'new-track-zone ' + (bottom ? 'bottom' : '') + (drop.hint?.key === 'new-' + index ? ' drop-active' : '')} data-new-track-index={index} style={{ marginLeft: 185, width }} {...drop.handlers('new-' + index, undefined, index)}><span>{bottom ? 'Drop media or text here to create a track' : 'Drop here for a new track'}</span>{ghost('new-' + index)}</div>;
  const trimCleanup = useRef<() => void>(() => {});
  useEffect(() => () => trimCleanup.current(), []);
  const trim = (event: React.PointerEvent, clip: Clip, edge: 'start' | 'end') => {
    event.stopPropagation(); event.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur();
    if (!state.selected.includes(clip.id)) state.select(clip.linkId ? project.tracks.flatMap(track => track.clips.filter(item => item.linkId === clip.linkId).map(item => item.id)) : [clip.id]);
    trimCleanup.current();
    const base = state.project!, pointer = event.pointerId, node = event.currentTarget;
    node.setPointerCapture(pointer);
    useEditor.setState({ playing: false, sourcePreview: null });
    const x = event.clientX, scrollX = scroller.current!.scrollLeft, original = edge === 'start' ? clip.start : endOf(clip);
    let clientX = x, target = original, valid = original, raf = 0;
    const update = () => {
      const scroll = scroller.current!;
      const rect = scroll.getBoundingClientRect();
      if (clientX > rect.right - 25) scroll.scrollLeft += 10;
      else if (clientX < rect.left + 200) scroll.scrollLeft -= 10;
      const next = snapped(original + (clientX - x + scroll.scrollLeft - scrollX) / scale, clip.id);
      if (next === target) return;
      target = next;
      try {
        const draft = produce(base, draft => { trimClip(draft, clip.id, edge, next); validateTimeline(draft); });
        valid = next; useEditor.setState({ dragPreview: draft });
      } catch { /* Keep the last legal trim at source and neighboring clip boundaries. */ }
    };
    const tick = () => { update(); raf = requestAnimationFrame(tick); };
    const move = (event: PointerEvent) => { if (event.pointerId === pointer) clientX = event.clientX; };
    const stop = () => {
      cancelAnimationFrame(raf); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key); window.removeEventListener('blur', stop);
      node.removeEventListener('lostpointercapture', stop);
      if (node.hasPointerCapture(pointer)) node.releasePointerCapture(pointer);
      useEditor.setState({ dragPreview: null }); trimCleanup.current = () => {};
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      clientX = event.clientX; update();
      if (valid !== original && useEditor.getState().project === base) state.edit(project => trimClip(project, clip.id, edge, valid));
      stop();
    };
    const cancel = (event: PointerEvent) => { if (event.pointerId === pointer) stop(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') stop(); };
    trimCleanup.current = stop;
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key); window.addEventListener('blur', stop); node.addEventListener('lostpointercapture', stop);
    raf = requestAnimationFrame(tick);
  };
  return <section className="timeline"><div className="timeline-toolbar"><div><TimelineTools/><button title="Undo (Ctrl+Z)" onClick={state.undo} disabled={!state.history.length}><Undo2 size={16}/></button><button title="Redo (Ctrl+Y)" onClick={state.redo} disabled={!state.future.length}><Redo2 size={16}/></button><span className="tool-separator"/><select aria-label="Close gaps scope" value={gapScope} onChange={event => setGapScope(event.target.value)}><option value="auto">Selected / main track</option><option value="all">Globally empty time</option><option value="track">Selected track</option></select><button title="Pull clips left to close gaps; linked clips move together" disabled={gapScope === 'track' && !selectedTrack} onClick={() => state.edit(project => gapScope === 'all' || !gapTrack ? closeTimelineGaps(project) : closeTrackGaps(project, (gapScope === 'track' ? selectedTrack! : gapTrack).id))}>Close gaps</button><button title="Split (S)" aria-label="Split selected" onClick={state.split}><Scissors size={16}/></button><button title="Delete (Delete)" onClick={() => state.remove()}><Trash2 size={16}/></button><button className={state.snap ? 'enabled' : ''} title="Snapping" onClick={() => useEditor.setState({ snap: !state.snap })}><Magnet size={16}/></button></div><div><span className="timeline-drop-help">Drag media or text into the timeline</span><button title="Fit timeline" onClick={() => useEditor.setState({ zoom: Math.max(10, Math.min(300, ((scroller.current?.clientWidth ?? 1000) - 200) / (duration / 1e6))) })}>Fit</button><input aria-label="Timeline zoom" type="range" min={10} max={300} value={state.zoom} onChange={event => useEditor.setState({ zoom: Number(event.target.value) })}/></div></div>
    <div className="timeline-scroll" ref={scroller} onWheel={event => { if (event.ctrlKey) { event.preventDefault(); useEditor.setState({ zoom: Math.max(10, Math.min(300, state.zoom * (event.deltaY > 0 ? .9 : 1.1))) }); } }}>
      <div className="timeline-content" onPointerDown={event => gesture.start(event)} style={{ width: width + 185 }}><div className="ruler-row"><div className="track-label">{timecode(state.playhead, project.settings.fps)}</div><div className="ruler" style={{ width }} onPointerDown={scrub}>{Array.from({ length: Math.ceil(duration / 1e6) + 1 }, (_, i) => i).filter(i => i % Math.max(1, Math.ceil(65 / state.zoom)) === 0).map(i => <span key={i} style={{ left: i * state.zoom }}>{i}s</span>)}{project.markers.map(marker => <button className="timeline-marker" title={marker.label} key={marker.id} style={{ left: marker.time * scale }} onClick={event => { event.stopPropagation(); state.seek(marker.time); }}>◆</button>)}</div></div>
      {[...project.tracks].reverse().map((track) => <Fragment key={track.id}>{zone(project.tracks.indexOf(track) + 1)}<div className="track-row"><div className="track-label"><input aria-label={`Name ${track.name}`} value={track.name} onChange={event => state.edit(project => { project.tracks.find(item => item.id === track.id)!.name = event.target.value; })}/><div>{(['locked', 'hidden', 'muted'] as const).map(key => <button key={key} title={`${key} ${track.name}`} onClick={() => state.edit(project => { const item = project.tracks.find(item => item.id === track.id)!; item[key] = !item[key]; })}>{key === 'locked' ? track.locked ? <Lock size={12}/> : <Unlock size={12}/> : key === 'hidden' ? track.hidden ? <EyeOff size={12}/> : <Eye size={12}/> : track.muted ? <VolumeX size={12}/> : <Volume2 size={12}/>}</button>)}<button title="Move track up" onClick={() => state.edit(project => { const i = project.tracks.findIndex(item => item.id === track.id); if (i < project.tracks.length - 1) [project.tracks[i], project.tracks[i + 1]] = [project.tracks[i + 1], project.tracks[i]]; })}><ChevronUp size={12}/></button><button title="Move track down" onClick={() => state.edit(project => { const i = project.tracks.findIndex(item => item.id === track.id); if (i > 0) [project.tracks[i], project.tracks[i - 1]] = [project.tracks[i - 1], project.tracks[i]]; })}><ChevronDown size={12}/></button><button title="Remove track" disabled={track.locked} onClick={() => { if (!track.clips.length || confirm('Remove this track and its clips?')) state.edit(project => { project.tracks = project.tracks.filter(item => item.id !== track.id); }); }}><Trash2 size={12}/></button></div></div>
        <div data-track-id={track.id} className={'track-lane ' + (track.locked ? 'locked' : '')} style={{ width }} {...drop.handlers(track.id, track.id)}>{ghost(track.id)}
          {track.clips.map(clip => { const view = clip.type === 'media' ? views.find(view => view.asset.id === clip.mediaId) : undefined; return <div data-clip-id={clip.id} key={clip.id} className={`timeline-clip ${track.kind} ${state.selected.includes(clip.id) ? 'selected-clip' : ''}`} style={{ left: clip.start * scale, width: clip.duration * scale }} draggable={false} onPointerDown={event => gesture.start(event, clip)} onDoubleClick={event => { event.stopPropagation(); const time = (event.clientX - event.currentTarget.getBoundingClientRect().left) / scale; state.edit(project => addClipKeyframe(editable(project, clip.id).clip, time)); }} onClick={event => event.stopPropagation()} onContextMenu={event => { event.preventDefault(); if (!state.selected.includes(clip.id)) state.select([clip.id]); setMenu({ x: event.clientX, y: event.clientY }); }}><span className="trim-handle left" onPointerDown={event => trim(event, clip, 'start')}/><strong>{clip.type === 'text' ? clip.content : view ? fileName(view.asset.path) : 'Media'}</strong>{track.kind === 'audio' && view ? <Waveform peaks={view.peaks}/> : view?.thumbnail ? <div className="clip-thumbnails" style={{ backgroundImage: `url("${view.thumbnail}")` }}/> : null}<TransitionHandle clip={clip} scale={scale}/><KeyframeMarkers clip={clip} scale={scale}/>{clip.type === 'media' && project.media[clip.mediaId]?.hasAudio && <FadeHandles clip={clip} scale={scale}/>}<span className="trim-handle right" onPointerDown={event => trim(event, clip, 'end')}/></div>; })}
        </div></div></Fragment>)}
      {zone(0, true)}
      {gesture.box && <div className="selection-marquee" style={gesture.box}><span>{state.selected.length} selected</span></div>}<div className="playhead" style={{ left: 185 + state.playhead * scale }}><span role="slider" tabIndex={0} aria-label="Timeline playhead" aria-valuemin={0} aria-valuemax={duration / 1e6} aria-valuenow={state.playhead / 1e6} onPointerDown={scrub} onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); useEditor.setState({ playing: false }); state.seek(Math.max(0, Math.min(duration, frameTime(toFrame(state.playhead, project.settings.fps) + (event.key === 'ArrowRight' ? 1 : -1), project.settings.fps)))); }}/></div></div>
    </div>{gesture.invalid && <div className="drag-feedback" role="status">{gesture.invalid}</div>}{menu && <div className="context-menu" style={{ left: menu.x, top: menu.y }} onMouseLeave={() => setMenu(null)}>{[['Split', state.split], ['Copy', state.copy], ['Duplicate', state.duplicate], ['Delete', () => state.remove()], ['Ripple delete', () => state.remove(true)]] .map(([name, action]) => <button key={String(name)} onClick={() => { (action as () => void)(); setMenu(null); }}>{String(name)}</button>)}</div>}
  </section>;
}
