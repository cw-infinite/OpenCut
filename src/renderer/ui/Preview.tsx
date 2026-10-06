import { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Maximize, Repeat2, Scan } from 'lucide-react';
import { useEditor } from '../state/editor';
import { useProjects } from '../state/projects';
import { MediaResources } from '../engine/resources';
import { renderFrame } from '../engine/compositor';
import { durationOf, editable } from '../engine/timeline';
import { frameTime, timecode, toFrame } from '../engine/time';
export function Preview(): JSX.Element {
  const state = useEditor(), project = state.project!;
  const canvas = useRef<HTMLCanvasElement>(null), container = useRef<HTMLDivElement>(null);
  const [quality, setQuality] = useState(.5), [loop, setLoop] = useState(false), [guides, setGuides] = useState(false);
  const resources = useRef<MediaResources | null>(null);
  const views = useProjects(state => state.views);
  useEffect(() => { const pool = new MediaResources(views); resources.current = pool; return () => pool.dispose(); }, [views]);
  useEffect(() => {
    let canceled = false, frame = 0;
    const pool = resources.current!, ctx = canvas.current!.getContext('2d')!;
    const startTime = performance.now(), start = state.playhead;
    const tick = async () => {
      if (canceled) return;
      let time = state.playing ? Math.round(start + (performance.now() - startTime) * 1000) : start;
      const duration = durationOf(project);
      if (state.playing && time >= duration) {
        pool.pause();
        if (loop && duration) { useEditor.setState({ playing: false, playhead: 0 }); queueMicrotask(() => useEditor.setState({ playing: true })); }
        else useEditor.setState({ playing: false, playhead: duration });
        return;
      }
      try {
        await pool.prepare(project, time, state.playing);
        if (canceled) return;
        renderFrame(ctx, project, time, pool);
        if (state.playing) { useEditor.setState({ playhead: time }); frame = requestAnimationFrame(() => void tick()); }
      } catch (error) { if (!canceled) useEditor.setState({ playing: false, error: String(error) }); }
    };
    void tick();
    return () => { canceled = true; cancelAnimationFrame(frame); pool.pause(); };
  }, [project, state.playing, state.playing ? null : state.playhead, quality, views, loop]);
  const step = (delta: number) => { useEditor.setState({ playing: false }); state.seek(frameTime(toFrame(state.playhead, project.settings.fps) + delta, project.settings.fps)); };
  return <section className="preview-panel"><div className="panel-heading"><h2>Preview</h2><span>{project.settings.width} × {project.settings.height} · {project.settings.fps} fps</span></div><div ref={container} className="canvas-wrap" onPointerDown={event => {
    const id = state.selected[0]; if (!id) return;
    const rect = canvas.current!.getBoundingClientRect();
    const up = (end: PointerEvent) => { state.edit(project => { const { clip } = editable(project, id); clip.transform.x.value += (end.clientX - event.clientX) / rect.width; clip.transform.y.value += (end.clientY - event.clientY) / rect.height; }); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointerup', up);
  }}><canvas ref={canvas} width={Math.round(project.settings.width * quality)} height={Math.round(project.settings.height * quality)} style={{ aspectRatio: `${project.settings.width}/${project.settings.height}` }}/>{guides && <div className="safe-area"/>}{state.selected.length > 0 && <span className="canvas-hint">Drag preview to position selected clip</span>}</div>
    <div className="player-controls"><span>{timecode(state.playhead, project.settings.fps)} <i>/ {timecode(durationOf(project), project.settings.fps)}</i></span><div><button title="Previous frame (←)" onClick={() => step(-1)}><SkipBack size={15}/></button><button title="Play / pause (Space)" aria-label="Play or pause" className="play-button" onClick={state.play}>{state.playing ? <Pause size={17}/> : <Play size={17}/>}</button><button title="Next frame (→)" onClick={() => step(1)}><SkipForward size={15}/></button></div><div><button className={loop ? 'enabled' : ''} title="Loop" onClick={() => setLoop(!loop)}><Repeat2 size={15}/></button><button title="Safe area" onClick={() => setGuides(!guides)}><Scan size={15}/></button><select aria-label="Preview quality" value={quality} onChange={event => setQuality(Number(event.target.value))}><option value={1}>Full</option><option value={.5}>Half</option><option value={.25}>Quarter</option></select><button title="Fullscreen preview" onClick={() => void container.current?.requestFullscreen()}><Maximize size={15}/></button></div></div>
  </section>;
}
