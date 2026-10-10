import { useEffect, useRef, useState } from 'react';
import type { MediaClip, Project } from '../../shared/types';
import { useEditor } from '../state/editor';
import { useProjects } from '../state/projects';
import { applyTracking, templateTracker, type TrackingPoint } from '../engine/tracking';
import { applyReframe, reframeSource } from '../engine/reframe';
import { trackingVideo } from '../engine/trackingVideo';

export function MotionTracking({ clip }: { clip: MediaClip }): JSX.Element {
  const state = useEditor(), project = state.project!, views = useProjects(state => state.views);
  const [frame, setFrame] = useState<ImageData | null>(null), [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [result, setResult] = useState<{ project: Project; points: TrackingPoint[] } | null>(null);
  const [mode, setMode] = useState<'overlay' | 'reframe'>('overlay');
  const [target, setTarget] = useState(''), [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null), controller = useRef<AbortController | null>(null), snapshot = useRef<Project | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!frame || !canvas.current) return;
    canvas.current.width = frame.width; canvas.current.height = frame.height;
    const ctx = canvas.current.getContext('2d')!; ctx.putImageData(frame, 0, 0);
    if (point) { ctx.strokeStyle = '#bbf27f'; ctx.lineWidth = 1; ctx.strokeRect(point.x - 8, point.y - 8, 17, 17); }
  }, [frame, point]);
  const load = async (track: boolean) => {
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError(''); setResult(null); setProgress(0); useEditor.setState({ playing: false });
    let decoder: Awaited<ReturnType<typeof trackingVideo>> | undefined;
    try {
      if (clip.duration > 60e6) throw new Error('Split the source into clips of 60 seconds or less before tracking.');
      if (track && snapshot.current !== project) throw new Error('Timeline changed. Load the first frame again.');
      const url = views.find(view => view.asset.id === clip.mediaId)?.url;
      if (!url) throw new Error('Source video is unavailable.');
      const input = mode === 'reframe' ? reframeSource(project, clip) : { project, clip };
      decoder = await trackingVideo(input.project, input.clip, url, abort.signal);
      const first = await decoder.frame(clip.start);
      if (!track) { setFrame(first); setPoint(null); snapshot.current = project; return; }
      if (!point) throw new Error('Choose a subject in the first frame.');
      const tracker = templateTracker(first, point.x, point.y), points: TrackingPoint[] = [{ time: clip.start, x: point.x / first.width, y: point.y / first.height }];
      const steps = Math.max(1, Math.ceil(clip.duration / 100000));
      for (let i = 1; i <= steps; i++) {
        const time = clip.start + Math.min(clip.duration - 1, Math.round(i * clip.duration / steps));
        const image = await decoder.frame(time), next = tracker(image);
        points.push({ time, x: next.x / image.width, y: next.y / image.height });
        setFrame(image); setPoint(next); setProgress(Math.round(i / steps * 100));
        await new Promise(resolve => setTimeout(resolve, 0));
        if (abort.signal.aborted) throw new Error('Tracking canceled.');
      }
      setResult({ project, points });
    } catch (error) { if (!abort.signal.aborted) { setError(String(error)); setFrame(null); setPoint(null); } }
    finally { decoder?.dispose(); if (!abort.signal.aborted) setBusy(false); }
  };
  const targets = project.tracks.filter(track => !track.locked && !track.hidden && track.kind !== 'audio').flatMap(track => track.clips).filter(item => item.id !== clip.id && item.start <= clip.start && item.start + item.duration >= clip.start + clip.duration && (item.type === 'text' || project.media[item.mediaId].kind === 'image'));
  return <details className="motion-tracking"><summary>Motion tracking</summary>
    <label>Tracking purpose<select aria-label="Tracking purpose" disabled={busy} value={mode} onChange={event => { setMode(event.target.value as 'overlay' | 'reframe'); setFrame(null); setPoint(null); setResult(null); }}><option value="overlay">Move an overlay</option><option value="reframe">Smart reframe to canvas</option></select></label>
    {mode === 'reframe' && <p>Choose your canvas preset in project settings first. Track the subject in the full source, then center it in this canvas without exposing edges. Replaces this clip's crop, position, scale, rotation and flips. Undo restores them.</p>}
    <p className="subtle">{mode === 'overlay' ? 'Track a detailed feature, then move a text or image overlay with it. The overlay must cover this video clip. ' : 'Track a detailed feature on the subject to keep it centered. '}Tracks up to 60 seconds; review fast movement and occlusion.</p>
    <button disabled={busy} onClick={() => void load(false)}>Load tracking frame</button>
    {frame && <><p>Click a detailed feature or edge in the first frame. The green box is the tracked area.</p><canvas ref={canvas} aria-label="Tracking subject frame" style={{ width: '100%', cursor: busy || result ? 'default' : 'crosshair' }} onClick={event => {
      if (busy || result || snapshot.current !== project) return;
      const box = event.currentTarget.getBoundingClientRect(); setPoint({ x: Math.round((event.clientX - box.left) / box.width * frame.width), y: Math.round((event.clientY - box.top) / box.height * frame.height) });
    }}/></>}
    <button disabled={busy || !point || !!result || snapshot.current !== project} onClick={() => void load(true)}>Track movement</button>
    {busy && <><p role="status">Tracking · {progress}%</p><button onClick={() => { controller.current?.abort(); setBusy(false); setFrame(null); setPoint(null); setResult(null); }}>Cancel tracking</button></>}
    {result && <><p role="status">Tracking complete · {result.points.length} positions. Review the path by applying it, then scrubbing the timeline. Undo restores the previous framing.</p>{mode === 'reframe' ? <button disabled={busy || result.project !== project} onClick={() => { state.edit(project => applyReframe(project, clip.id, result.points)); if (!useEditor.getState().error) { setResult(null); setFrame(null); setPoint(null); state.seek(clip.start); } }}>Apply smart reframe</button> : <><label>Tracked overlay<select aria-label="Tracked overlay" value={target} onChange={event => setTarget(event.target.value)}><option value="">Choose overlay</option>{targets.map(item => <option key={item.id} value={item.id}>{item.type === 'text' ? item.content.slice(0, 40) : project.media[item.mediaId].path.split(/[\\/]/).pop()}</option>)}</select></label><p className="subtle">Replaces X/Y keyframes during the tracked interval and keeps the overlay's initial offset.</p><button disabled={busy || result.project !== project || !targets.some(item => item.id === target)} onClick={() => {
      state.edit(project => applyTracking(project, clip.id, target, result.points));
      if (!useEditor.getState().error) { setResult(null); setFrame(null); setPoint(null); state.seek(clip.start); }
    }}>Apply tracking to overlay</button></>}</>}
    {frame && snapshot.current !== project && <p>Timeline changed. Load the first frame again.</p>}
    {mode === 'overlay' && !targets.length && <p>Add a text or image overlay spanning the entire video clip to apply tracking.</p>}
    {error && <p role="alert">{error}</p>}
  </details>;
}
