import { useState } from 'react';
import { FileVideo2, Image, Music2, Plus, Search, Trash2, UploadCloud } from 'lucide-react';
import { useProjects } from '../state/projects';
import type { MediaView } from '../../shared/api';

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
  const selected = store.views.find(view => view.asset.id === store.selected);
  const views = store.views.filter(view => fileName(view.asset.path).toLowerCase().includes(search.toLowerCase()));
  const remove = async (view: MediaView) => {
    if (!store.project || !confirm(`Remove “${fileName(view.asset.path)}” from this library? The original file will be kept.`)) return;
    try { await store.setProject(await window.opencut.media.remove(store.project.id, view.asset.id)); } catch (error) { setError(String(error)); }
  };
  return <main className={'media-workspace ' + (dragging ? 'dragging' : '')} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); void store.import(Array.from(event.dataTransfer.files)); }}>
    <section className="media-panel"><div className="panel-heading"><h2>Media library</h2><button className="icon-button" title="Import media" aria-label="Import media" disabled={store.busy} onClick={() => void store.import()}><Plus size={18}/></button></div>
      <div className="search"><Search size={14}/><input aria-label="Search media" placeholder="Search your media" value={search} onChange={event => setSearch(event.target.value)}/></div>
      <button className="import-button" disabled={store.busy} onClick={() => void store.import()}><UploadCloud size={17}/>{store.busy ? 'Preparing media…' : 'Import media'}</button>
      <div className="library-count">{views.length} ITEMS <span>Video · Audio · Images</span></div>
      <div className="media-grid">{views.map(view => <div className={'media-card ' + (store.selected === view.asset.id ? 'active' : '')} key={view.asset.id}><button className="media-select" onClick={() => store.select(view.asset.id)}><div className="media-thumb">{view.thumbnail ? <img src={view.thumbnail} alt=""/> : view.asset.kind === 'audio' ? <Waveform peaks={view.peaks}/> : view.asset.kind === 'image' ? <Image size={26}/> : <FileVideo2 size={26}/>}<span>{formatTime(view.asset.duration)}</span></div><strong title={view.asset.path}>{fileName(view.asset.path)}</strong><small>{view.asset.status === 'ready' ? view.asset.kind === 'audio' ? 'Audio' : `${view.asset.width} × ${view.asset.height}` : view.asset.status}</small></button><button aria-label={`Remove ${fileName(view.asset.path)}`} className="media-delete" disabled={store.busy} onClick={() => void remove(view)}><Trash2 size={12}/></button></div>)}</div>
      {!views.length && <p className="library-empty">Drop your footage here.<br/>Original files stay right where they are.</p>}
    </section>
    <section className="source-panel"><div className="panel-heading"><h2>Source preview</h2><span>{selected ? fileName(selected.asset.path) : 'No media selected'}</span></div><div className="source-stage">{selected && selected.asset.status === 'ready' ? selected.asset.kind === 'image' ? <img src={selected.url} alt={fileName(selected.asset.path)}/> : selected.asset.kind === 'audio' ? <div className="audio-preview"><Music2 size={40}/><Waveform peaks={selected.peaks}/><audio key={selected.url} src={selected.url} controls/></div> : <video key={selected.url} src={selected.url} controls preload="metadata"/> : <div className="source-empty"><div><FileVideo2 size={38}/></div><h2>Your next story, frame by frame.</h2><p>Import media, then select a file to preview it.</p><button className="primary" disabled={store.busy} onClick={() => void store.import()}><Plus size={15}/> Import media</button></div>}</div>
      <div className="source-details">{selected ? <><span>{selected.asset.kind.toUpperCase()}</span><span>{formatTime(selected.asset.duration)}</span><span>{selected.asset.fps ? selected.asset.fps.toFixed(2) + ' source fps' : 'Still / audio'}</span><span>{selected.asset.hasAudio ? 'Audio included' : 'No audio'}</span></> : <span>Local preview · Original media is never modified</span>}</div>
      <div className="next-milestone"><span className="phase">READY TO EDIT</span><p>Open the timeline to arrange your media, trim clips, and preview your edit. Compiled video export is still in development.</p></div>
      {store.progress && <div className="import-progress" role="status"><div><strong>{store.progress.name}</strong><span>{store.progress.stage} · {store.progress.percent}%</span></div><progress max={100} value={store.progress.percent}/></div>}
      {error && <div className="error" role="alert">{error}</div>}
    </section>{dragging && <div className="drop-overlay"><UploadCloud size={44}/><h2>Drop to import into this project</h2></div>}
  </main>;
}
