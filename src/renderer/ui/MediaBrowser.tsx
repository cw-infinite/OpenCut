import { useEffect, useRef, useState } from 'react';
import { FileVideo2, Image, Music2, Plus, Search, Trash2, UploadCloud } from 'lucide-react';
import { useProjects } from '../state/projects';

export const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
const formatTime = (us: number) => `${Math.floor(us / 60_000_000).toString().padStart(2, '0')}:${Math.floor(us / 1_000_000 % 60).toString().padStart(2, '0')}`;
export function Waveform({ peaks }: { peaks: number[] }): JSX.Element {
  const bins = Array.from({ length: 160 }, (_, i) => Math.max(.025, ...peaks.slice(Math.floor(i * peaks.length / 160), Math.max(Math.floor(i * peaks.length / 160) + 1, Math.floor((i + 1) * peaks.length / 160)))));
  return <svg className="waveform" viewBox="0 0 480 100" preserveAspectRatio="none" aria-label="Audio waveform">{bins.map((peak, i) => <rect key={i} x={i * 3} y={50 - peak * 45} width={1.8} height={peak * 90} rx={1}/>)}</svg>;
}
export function MediaBrowser(): JSX.Element {
  const store = useProjects();
  const [search, setSearch] = useState('');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [relinking, setRelinking] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const gesture = useRef<{ x: number; y: number; initial: string[] } | null>(null);
  const anchor = useRef<string | null>(null);
  const busy = store.busy || removing || relinking;
  useEffect(() => { setSelection([]); anchor.current = null; }, [store.project?.id]);
  useEffect(() => { setSelection(ids => ids.filter(id => store.views.some(view => view.asset.id === id))); }, [store.views]);
  const selected = store.views.find(view => view.asset.id === store.selected);
  const views = store.views.filter(view => fileName(view.asset.path).toLowerCase().includes(search.toLowerCase()));
  const relink = async () => {
    if (!store.project || !selected) return;
    setRelinking(true); setError('');
    try { await store.setProject(await window.opencut.media.relink(store.project.id, selected.asset.id)); }
    catch (error) { setError(String(error)); }
    finally { setRelinking(false); }
  };
  const select = (id: string, toggle: boolean, range: boolean) => {
    const start = views.findIndex(view => view.asset.id === anchor.current);
    const end = views.findIndex(view => view.asset.id === id);
    if (range && start >= 0) {
      const ids = views.slice(Math.min(start, end), Math.max(start, end) + 1).map(view => view.asset.id);
      setSelection(current => toggle ? [...new Set([...current, ...ids])] : ids);
    } else {
      setSelection(current => toggle ? current.includes(id) ? current.filter(value => value !== id) : [...current, id] : [id]);
      anchor.current = id;
    }
    store.select(id);
  };
  const remove = async (ids: string[], all = false) => {
    if (!store.project || busy || !ids.length || !confirm(`Delete ${all ? 'all ' : ''}${ids.length} item${ids.length === 1 ? '' : 's'} from this library? Original files will be kept. Media used on the timeline must be removed from the timeline first.`)) return;
    setRemoving(true); setError('');
    useProjects.setState({ busy: true });
    try { await store.setProject(await window.opencut.media.remove(store.project.id, ids)); }
    catch (error) { setError(String(error)); }
    finally { setRemoving(false); useProjects.setState({ busy: false }); }
  };
  return <main className={'media-workspace ' + (dragging ? 'dragging' : '')} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); void store.import(Array.from(event.dataTransfer.files)); }}>
    <section className="media-panel"><div className="panel-heading"><h2>Media library</h2><button className="icon-button" title="Import media" aria-label="Import media" disabled={busy} onClick={() => void store.import()}><Plus size={18}/></button></div>
      <div className="search"><Search size={14}/><input aria-label="Search media" placeholder="Search your media" value={search} onChange={event => setSearch(event.target.value)}/></div>
      <button className="import-button" disabled={busy} onClick={() => void store.import()}><UploadCloud size={17}/>{store.busy ? 'Preparing media…' : 'Import media'}</button>
      <div className="library-count">{views.length} ITEMS <span>Video · Audio · Images</span></div>
      <div className="library-actions">
        <button className="secondary" disabled={busy || !views.length} onClick={() => setSelection(views.map(view => view.asset.id))}>Select visible</button>
        <button className="secondary" disabled={busy || !selection.length} onClick={() => setSelection([])}>Clear selection</button>
        <button className="secondary" disabled={busy || !selection.length} onClick={() => void remove(selection)}>Delete selected ({selection.length})</button>
        <button className="secondary" disabled={busy || !store.views.length} onClick={() => void remove(store.views.map(view => view.asset.id), true)}>Delete all ({store.views.length})</button>
      </div>
      <p className="library-selection-help">Drag from empty space to select. Ctrl-click toggles items; Shift-click selects a range.</p>
      <div className="library-selection-area" onDragStart={event => event.preventDefault()} onPointerDown={event => {
        if (busy || event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current = { x: event.clientX, y: event.clientY, initial: event.ctrlKey || event.metaKey || event.shiftKey ? selection : [] };
        if (!gesture.current.initial.length) setSelection([]);
      }} onPointerMove={event => {
        const start = gesture.current;
        if (!start) return;
        const rectangle = { left: Math.min(start.x, event.clientX), top: Math.min(start.y, event.clientY), width: Math.abs(event.clientX - start.x), height: Math.abs(event.clientY - start.y) };
        setBox(rectangle);
        const ids = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-media-id]')).filter(element => {
          const bounds = element.getBoundingClientRect();
          return bounds.left < rectangle.left + rectangle.width && bounds.right > rectangle.left && bounds.top < rectangle.top + rectangle.height && bounds.bottom > rectangle.top;
        }).map(element => element.dataset.mediaId!);
        setSelection([...new Set([...start.initial, ...ids])]);
      }} onPointerUp={event => {
        gesture.current = null; setBox(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }} onPointerCancel={() => { gesture.current = null; setBox(null); }} onLostPointerCapture={() => { gesture.current = null; setBox(null); }}>
      <div className="media-grid">{views.map(view => <div className={'media-card ' + (selection.includes(view.asset.id) ? 'active' : '')} key={view.asset.id} data-media-id={view.asset.id}><button className="media-select" disabled={busy} aria-pressed={selection.includes(view.asset.id)} onClick={event => select(view.asset.id, event.ctrlKey || event.metaKey, event.shiftKey)}><div className="media-thumb">{view.thumbnail ? <img src={view.thumbnail} alt=""/> : view.asset.kind === 'audio' ? <Waveform peaks={view.peaks}/> : view.asset.kind === 'image' ? <Image size={26}/> : <FileVideo2 size={26}/>}<span>{formatTime(view.asset.duration)}</span></div><strong title={view.asset.path}>{fileName(view.asset.path)}</strong><small>{view.missing ? 'Missing source' : view.asset.status === 'ready' ? view.asset.kind === 'audio' ? 'Audio' : `${view.asset.width} × ${view.asset.height}` : view.asset.status}</small></button><button aria-label={`Remove ${fileName(view.asset.path)}`} className="media-delete" disabled={busy} onClick={() => void remove([view.asset.id])}><Trash2 size={12}/></button></div>)}</div>
      {!views.length && <p className="library-empty">Drop your footage here.<br/>Original files stay right where they are.</p>}
      </div>
      {box && <div className="library-selection-box" style={box}/>}
    </section>
    <section className="source-panel"><div className="panel-heading"><h2>Source preview</h2><span>{selected ? fileName(selected.asset.path) : 'No media selected'}</span></div><div className="source-stage">{selected && selected.asset.status === 'ready' ? selected.asset.kind === 'image' ? <img src={selected.url} alt={fileName(selected.asset.path)}/> : selected.asset.kind === 'audio' ? <div className="audio-preview"><Music2 size={40}/><Waveform peaks={selected.peaks}/><audio key={selected.url} src={selected.url} controls/></div> : <video key={selected.url} src={selected.url} controls preload="metadata"/> : <div className="source-empty"><div><FileVideo2 size={38}/></div><h2>Your next story, frame by frame.</h2><p>Import media, then select a file to preview it.</p><button className="primary" disabled={busy} onClick={() => void store.import()}><Plus size={15}/> Import media</button></div>}</div>
      <div className="source-details">{selected ? <><span>{selected.asset.kind.toUpperCase()}</span><span>{formatTime(selected.asset.duration)}</span><span>{selected.asset.fps ? selected.asset.fps.toFixed(2) + ' source fps' : 'Still / audio'}</span><span>{selected.asset.hasAudio ? 'Audio included' : 'No audio'}</span></> : <span>Local preview · Original media is never modified</span>}</div>
      {selected && <div className="source-details">{selected.missing && <span role="status">Original file is missing. Locate it to restore export audio and source access.</span>}<button className="secondary" disabled={busy} onClick={() => void relink()}>{relinking ? 'Preparing replacement…' : 'Relink selected media'}</button></div>}
      <div className="next-milestone"><span className="phase">READY TO EDIT</span><p>Open the timeline to arrange your media, trim clips, and export your edit.</p></div>
      {store.progress && <div className="import-progress" role="status"><div><strong>{store.progress.name}</strong><span>{store.progress.stage} · {store.progress.percent}%</span></div><progress max={100} value={store.progress.percent}/></div>}
      {error && <div className="error" role="alert">{error}</div>}
    </section>{dragging && <div className="drop-overlay"><UploadCloud size={44}/><h2>Drop to import into this project</h2></div>}
  </main>;
}
