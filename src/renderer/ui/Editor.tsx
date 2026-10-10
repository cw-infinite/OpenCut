import { CreativeDialog } from './CreativeDialog';
import { Voiceover } from './Voiceover';
import { VideoCapture } from './VideoCapture';
import { CaptionsDialog } from './CaptionsDialog';
import { useEffect, useState } from 'react';
import { Film, Plus, Sun, Moon, Search, ArrowLeft } from 'lucide-react';
import { useEditor } from '../state/editor';
import { useProjects } from '../state/projects';
import { durationOf } from '../engine/timeline';
import { frameTime, toFrame, timecode } from '../engine/time';
import { fileName, Waveform } from './MediaBrowser';
import { Preview } from './Preview';
import { Timeline } from './Timeline';
import { Inspector } from './Inspector';
import { ExportDialog } from './ExportDialog';
import '../app/editor.css';

export function Editor({ onBack }: { onBack(): void }): JSX.Element {
  const source = useProjects(), state = useEditor();
  const [search, setSearch] = useState(''), [light, setLight] = useState(false);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [speechOpen, setSpeechOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [captionsOpen, setCaptionsOpen] = useState(false);
  useEffect(() => { state.load(source.project!); return () => useEditor.setState({ playing: false }); }, []);
  useEffect(() => {
    const save = async () => {
      const snapshot = useEditor.getState(); if (!snapshot.project || !snapshot.dirty) return;
      try { await window.opencut.projects.saveEdit(snapshot.project); if (snapshot.project === useEditor.getState().project) useEditor.setState({ dirty: false }); }
      catch (error) { useEditor.setState({ error: `Autosave failed: ${String(error)}` }); }
    };
    const timer = setTimeout(() => void save(), 400), interval = setInterval(() => void save(), 5000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [state.project]);
  useEffect(() => {
    let closing = false;
    const beforeClose = (event: BeforeUnloadEvent) => {
      const current = useEditor.getState();
      if (closing || !current.dirty || !current.project) return;
      event.preventDefault(); event.returnValue = false;
      void window.opencut.projects.saveEdit(current.project).then(() => { closing = true; window.close(); }).catch(error => useEditor.setState({ error: String(error) }));
    };
    window.addEventListener('beforeunload', beforeClose);
    return () => window.removeEventListener('beforeunload', beforeClose);
  }, []);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]') || (event.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')) return;
      const state = useEditor.getState(), project = state.project; if (!project) return;
      const key = event.key.toLowerCase(), mod = event.ctrlKey || event.metaKey;
      const actions: Record<string, () => void> = mod ? {
        z: event.shiftKey ? state.redo : state.undo, y: state.redo, c: state.copy, v: state.paste, d: state.duplicate
      } : {
        ' ': state.play, s: state.split, delete: () => state.remove(event.shiftKey),
        arrowleft: () => state.seek(event.shiftKey ? state.playhead - 1e6 : frameTime(toFrame(state.playhead, project.settings.fps) - 1, project.settings.fps)),
        arrowright: () => state.seek(event.shiftKey ? state.playhead + 1e6 : frameTime(toFrame(state.playhead, project.settings.fps) + 1, project.settings.fps)),
        home: () => state.seek(0), end: () => state.seek(durationOf(project)),
        '+': () => useEditor.setState({ zoom: Math.min(300, state.zoom * 1.2) }), '=': () => useEditor.setState({ zoom: Math.min(300, state.zoom * 1.2) }), '-': () => useEditor.setState({ zoom: Math.max(10, state.zoom / 1.2) }),
        m: () => state.edit(project => { project.markers.push({ id: crypto.randomUUID(), time: state.playhead, label: `Marker ${project.markers.length + 1}` }); }),
        i: () => setRange(range => ({ ...range, start: state.playhead })), o: () => setRange(range => ({ ...range, end: state.playhead }))
      };
      if (actions[key]) { event.preventDefault(); actions[key](); }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, []);
  if (!state.project) return <div>Loading timeline…</div>;
  return <div className={'editing-workspace ' + (light ? 'light' : '')}><div className="editor-subbar"><button className="secondary" onClick={async () => {
    useEditor.setState({ playing: false });
    try { await source.setProject(await window.opencut.projects.saveEdit(useEditor.getState().project!)); useEditor.setState({ dirty: false }); onBack(); } catch (error) { useEditor.setState({ error: String(error) }); }
  }}><ArrowLeft size={14}/> Source browser</button><span>{state.dirty ? 'Saving…' : 'All edits saved'}{range.end > range.start ? ` · Range ${timecode(range.start)} – ${timecode(range.end)}` : ''}</span><div className="editor-export-actions"><Voiceover/><VideoCapture/><button className="secondary" onClick={() => setCaptionsOpen(true)}>Captions</button><button className="secondary" onClick={() => state.addText()} draggable onDragStart={event => { event.dataTransfer.setData('application/opencut-text', 'text'); useEditor.setState({ dragItem: { kind: 'text' } }); }} onDragEnd={() => useEditor.setState({ dragItem: null })}>Add text</button><button title="Change theme" aria-label="Change theme" onClick={() => setLight(!light)}>{light ? <Moon size={16}/> : <Sun size={16}/>}</button><button className="primary" onClick={() => setExportOpen(true)}>Export</button></div></div>
    {state.error && <div className="error" role="alert">{state.error}<button onClick={() => useEditor.setState({ error: null })}>Dismiss</button></div>}
    <div className="editor-top"><section className="editor-library"><div className="panel-heading"><h2>Media</h2><Film size={15}/></div><button className="speech-library-button" onClick={() => setSpeechOpen(true)}>Text to speech</button><div className="search"><Search size={13}/><input placeholder="Search media" aria-label="Search timeline media" value={search} onChange={event => setSearch(event.target.value)}/></div><p className="subtle">Drag media or text into a track, or between tracks to create one.</p><button className="library-text-tile" draggable onDragStart={event => { event.dataTransfer.setData('application/opencut-text', 'text'); useEditor.setState({ dragItem: { kind: 'text' } }); }} onDragEnd={() => useEditor.setState({ dragItem: null })} onDoubleClick={() => state.addText()}><span>T</span><strong>Text</strong><small>Drag to timeline</small></button><div className="media-grid">{source.views.filter(view => fileName(view.asset.path).toLowerCase().includes(search.toLowerCase())).map(view => <button className="editor-asset media-card" key={view.asset.id} disabled={view.asset.status !== 'ready'} draggable={view.asset.status === 'ready'} onDragStart={event => { event.dataTransfer.setData('application/opencut-media', view.asset.id); useEditor.setState({ dragItem: { kind: 'media', id: view.asset.id } }); }} onDragEnd={() => useEditor.setState({ dragItem: null })} onDoubleClick={() => state.addMedia(view.asset.id)}><div className="media-thumb">{view.thumbnail ? <img src={view.thumbnail} alt=""/> : <Waveform peaks={view.peaks}/>}</div><strong>{fileName(view.asset.path)}</strong><small>{view.asset.kind} <Plus size={10}/></small></button>)}</div></section><Preview/><Inspector/></div><Timeline/>
    {speechOpen && <CreativeDialog onClose={() => setSpeechOpen(false)}/>}
    {exportOpen && <ExportDialog range={range} onClose={() => setExportOpen(false)}/>}
    {captionsOpen && <CaptionsDialog range={range} onClose={() => setCaptionsOpen(false)}/>}
  </div>;
}
