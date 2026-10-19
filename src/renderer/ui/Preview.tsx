import { CanvasTextEditor } from './CanvasTextEditor';
import { FrameExport } from './FrameExport';
import { usePreviewGesture } from './usePreviewGesture';
import { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Maximize, Repeat2, Scan } from 'lucide-react';
import { useEditor } from '../state/editor';
import { useProjects } from '../state/projects';
import { MediaResources } from '../engine/resources';
import { renderFrame } from '../engine/compositor';
import { durationOf } from '../engine/timeline';
import { frameTime, timecode, toFrame } from '../engine/time';
import { fileName } from './MediaBrowser';
import { TransformHandles } from './TransformHandles';
export function Preview({ large = false, onToggleLarge }: { large?: boolean; onToggleLarge?: () => void }): JSX.Element {
  const state = useEditor(), project = state.dragPreview ?? state.project!;
  const [editingText, setEditingText] = useState<string | null>(null);
  const textClip = project.tracks.flatMap(track => track.clips).find(clip => clip.id === editingText);
  const canvas = useRef<HTMLCanvasElement>(null), container = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const gesture = usePreviewGesture(canvas);
  const [zoom, setZoom] = useState(1), [size, setSize] = useState({ width: 600, height: 350 }), [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const node = container.current!;
    const observer = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; setSize(previous => previous.width === width && previous.height === height ? previous : { width, height }); }); observer.observe(node);
    const changed = () => setFullscreen(document.fullscreenElement === panel.current);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && document.fullscreenElement === panel.current) { event.preventDefault(); void document.exitFullscreen().catch(error => useEditor.setState({ error: String(error) })); } };
    document.addEventListener('fullscreenchange', changed);
    window.addEventListener('keydown', escape);
    return () => { observer.disconnect(); document.removeEventListener('fullscreenchange', changed); window.removeEventListener('keydown', escape); };
  }, []);
  useEffect(() => { const node = container.current!; node.scrollLeft = (node.scrollWidth - node.clientWidth) / 2; node.scrollTop = (node.scrollHeight - node.clientHeight) / 2; }, [zoom, size]);
  const fit = Math.min(Math.max(1, size.width - 2) / project.settings.width, Math.max(1, size.height - 2) / project.settings.height);
  const display = { width: Math.max(1, project.settings.width * fit * zoom), height: Math.max(1, project.settings.height * fit * zoom) };
  const toggleFullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await panel.current!.requestFullscreen(); }
    catch (error) { useEditor.setState({ error: `Fullscreen preview: ${String(error)}` }); }
  };
  const [quality, setQuality] = useState(.5), [loop, setLoop] = useState(false), [guides, setGuides] = useState(false);
  const resources = useRef<MediaResources | null>(null);
  const preparation = useRef<Promise<void>>(Promise.resolve());
  const views = useProjects(state => state.views);
  const source = views.find(view => view.asset.id === state.sourcePreview);
  useEffect(() => { const pool = new MediaResources(views); resources.current = pool; return () => pool.dispose(); }, [views]);
  useEffect(() => {
    if (source) { resources.current?.pause(); return; }
    let canceled = false, frame = 0, renderedTime = -1;
    const pool = resources.current!, ctx = canvas.current!.getContext('2d')!;
    const startTime = performance.now(), start = state.playhead;
    const tick = async () => {
      if (canceled) return;
      let time = state.playing ? Math.round(start + (performance.now() - startTime) * 1000) : useEditor.getState().playhead;
      if (!state.playing && time === renderedTime) { frame = requestAnimationFrame(() => void tick()); return; }
      const duration = durationOf(project);
      if (state.playing && time >= duration) {
        pool.pause();
        if (loop && duration) { useEditor.setState({ playing: false, playhead: 0 }); queueMicrotask(() => useEditor.setState({ playing: true })); }
        else useEditor.setState({ playing: false, playhead: duration });
        return;
      }
      try {
        const pending = preparation.current.catch(() => {}).then(async () => { if (!canceled) await pool.prepare(project, time, state.playing); });
        preparation.current = pending;
        await pending;
        if (canceled) return;
        renderFrame(ctx, project, time, pool);
        ctx.canvas.dataset.renderTime = String(time);
        renderedTime = time;
        if (state.playing) useEditor.setState({ playhead: time });
        frame = requestAnimationFrame(() => void tick());
      } catch (error) { if (!canceled) useEditor.setState({ playing: false, error: String(error) }); }
    };
    void tick();
    return () => { canceled = true; cancelAnimationFrame(frame); pool.pause(); };
  }, [project, state.playing, quality, views, loop, source]);
  const step = (delta: number) => { useEditor.setState({ playing: false }); state.seek(frameTime(toFrame(state.playhead, project.settings.fps) + delta, project.settings.fps)); };
  return <section ref={panel} className="preview-panel"><div className="panel-heading"><h2>{source ? 'Source preview' : 'Preview'}</h2><FrameExport/>{onToggleLarge && <button className="preview-layout-button" aria-pressed={large} onClick={onToggleLarge}>{large ? 'Standard layout' : 'Large preview'}</button>}<span>{project.settings.width} × {project.settings.height} · {project.settings.fps} fps</span></div>{source && <div className="source-preview-heading"><span>{fileName(source.asset.path)}</span><button onClick={() => useEditor.setState({ sourcePreview: null })}>Back to timeline</button></div>}<div ref={container} className="canvas-wrap">{source && <div className="source-preview">{source.asset.kind === 'image' ? <img src={source.url} alt={fileName(source.asset.path)}/> : <video key={source.asset.id} src={source.url} autoPlay controls playsInline onError={() => useEditor.setState({ error: 'Could not play this source media' })}/>}</div>}<div className="preview-space" style={{ visibility: source ? 'hidden' : 'visible', width: Math.max(size.width, display.width), height: Math.max(size.height, display.height) }}><div className="canvas-surface" style={display} onDoubleClick={() => { const clip = project.tracks.flatMap(track => track.clips).find(clip => clip.id === state.selected[0]); if (clip?.type === 'text') { useEditor.setState({ playing: false }); setEditingText(clip.id); } }} onPointerDown={event => {
    if (source || event.button !== 0 || (event.target as HTMLElement).closest('button,input,textarea') || !state.selected.length) return;
    gesture(event);
  }}><canvas ref={canvas} width={Math.round(project.settings.width * quality)} height={Math.round(project.settings.height * quality)} style={{ aspectRatio: `${project.settings.width}/${project.settings.height}` }}/>{guides && <div className="safe-area"/>}<TransformHandles canvas={canvas} gesture={gesture}/>{textClip?.type === 'text' && <CanvasTextEditor key={textClip.id} clip={textClip} onClose={() => setEditingText(null)}/>}</div></div></div>
    <div className="preview-zoom" style={{ visibility: source ? 'hidden' : 'visible' }}><button aria-label="Zoom preview out" disabled={zoom <= .25} onClick={() => setZoom(Math.max(.25, zoom - .25))}>−</button><label>Preview zoom <input aria-label="Preview zoom" type="range" min={.25} max={3} step={.25} value={zoom} onChange={event => setZoom(Number(event.target.value))}/></label><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom preview in" disabled={zoom >= 3} onClick={() => setZoom(Math.min(3, zoom + .25))}>+</button><button onClick={() => setZoom(1)}>Fit preview</button></div><div className="player-controls" style={{ visibility: source ? 'hidden' : 'visible' }}><span>{timecode(state.playhead, project.settings.fps)} <i>/ {timecode(durationOf(project), project.settings.fps)}</i></span><div><button title="Previous frame (←)" onClick={() => step(-1)}><SkipBack size={15}/></button><button title="Play / pause (Space)" aria-label="Play or pause" className="play-button" onClick={state.play}>{state.playing ? <Pause size={17}/> : <Play size={17}/>}</button><button title="Next frame (→)" onClick={() => step(1)}><SkipForward size={15}/></button></div><div><button className={loop ? 'enabled' : ''} title="Loop" onClick={() => setLoop(!loop)}><Repeat2 size={15}/></button><button title="Safe area" onClick={() => setGuides(!guides)}><Scan size={15}/></button><select aria-label="Preview quality" value={quality} onChange={event => setQuality(Number(event.target.value))}><option value={1}>Full</option><option value={.5}>Half</option><option value={.25}>Quarter</option></select><button title={fullscreen ? "Exit fullscreen preview" : "Fullscreen preview"} aria-label={fullscreen ? "Exit fullscreen preview" : "Fullscreen preview"} onClick={() => void toggleFullscreen()}><Maximize size={15}/></button></div></div>
  </section>;
}
