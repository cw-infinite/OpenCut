import { ProjectCollection } from './ProjectCollection';
import { useEffect, useState } from 'react';
import { Clapperboard, Folder, Plus, Scissors, Settings2, ArrowLeft, HardDrive } from 'lucide-react';
import { useProjects } from '../state/projects';
import { ProjectDialog } from './ProjectDialog';
import { MediaBrowser } from './MediaBrowser';
import { Editor } from './Editor';
import { useEditor } from '../state/editor';
import '../app/workspace.css';

export function Projects({ onTools }: { onTools(): void }): JSX.Element {
  const store = useProjects();
  const [dialog, setDialog] = useState(false);
  const [actionError, setActionError] = useState('');
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    void store.refresh();
    void window.opencut.projects.last().then(id => { if (id && !useProjects.getState().project) void useProjects.getState().open(id); });
    return window.opencut.media.onProgress(store.updateProgress);
  }, []);
  const act = async (action: () => Promise<unknown>) => { try { setActionError(''); await action(); await store.refresh(); } catch (error) { setActionError(String(error)); } };
  const leaveEditor = async (action: () => void) => {
    try {
      if (editing && useEditor.getState().project) {
        useEditor.setState({ playing: false });
        await store.setProject(await window.opencut.projects.saveEdit(useEditor.getState().project!));
        useEditor.setState({ dirty: false });
      }
      setEditing(false); action();
    } catch (error) { setActionError(`Could not save: ${String(error)}`); }
  };
  return <div className={'project-shell' + (editing && store.project ? ' timeline-open' : '')}>
    <header className="editor-header">
      <button className="brand" onClick={() => void leaveEditor(store.close)}><span className="brand-mark"><Scissors size={23}/></span>OpenCut</button>
      <span className="header-divider"/>
      {store.project ? <><button className="breadcrumb" onClick={() => void leaveEditor(store.close)}><ArrowLeft size={14}/> Projects</button><span className="project-title">{store.project.name}</span><span className="autosave"><span className="local-dot"/> {editing ? 'Local timeline' : 'Saved locally'}</span></> : <span className="project-title">Your workspace</span>}
      <div className="header-actions">{store.project && <button className="secondary" disabled={store.busy} onClick={() => void leaveEditor(() => setDialog(true))}><Settings2 size={15}/> Project settings</button>}<button className="icon-button" title="Local tool settings" aria-label="Local tool settings" onClick={() => void leaveEditor(onTools)}><HardDrive size={18}/></button></div>
    </header>
    {(store.error || actionError) && <div className="error" role="alert">{store.error || actionError}<button onClick={() => { store.clearError(); setActionError(''); }}>Dismiss</button></div>}
    {store.recovered && <div className="recovery">Recovered this project from its last valid local save. Your original media files were not changed.</div>}
    {store.project ? editing ? <Editor key={store.project.id} onBack={() => setEditing(false)}/> : <><div className="source-editor-action"><span>Prepare your footage, then start building your story.</span><button className="primary" onClick={() => setEditing(true)} disabled={store.busy}>Open timeline</button></div><MediaBrowser/></> : <main className="projects-home"><div className="home-heading"><div><div className="eyebrow">YOUR CREATIVE SPACE</div><h1>Every story starts here.</h1><p className="subtle">Your projects, your footage. All on this computer.</p></div><button className="primary" onClick={() => setDialog(true)}><Plus size={17}/> New project</button></div>
      <div className="section-title"><h2><Folder size={17}/> Recent projects</h2><span>{store.list.length} projects</span></div>
      {!store.list.length ? <div className="empty-projects"><Clapperboard size={46}/><h2>Make room for your next idea</h2><p>Create a project and bring in your video, music, and images.</p><button className="primary" onClick={() => setDialog(true)}><Plus size={16}/> Create your first project</button></div> : <ProjectCollection projects={store.list} busy={store.busy} rename={async (id, name) => { await window.opencut.projects.rename(id, name); await store.refresh(); }} open={id => void store.open(id)} duplicate={id => void act(() => window.opencut.projects.duplicate(id))} remove={id => void act(() => window.opencut.projects.remove(id))}/>}

    </main>}
    {dialog && <ProjectDialog project={store.project ?? undefined} onClose={() => setDialog(false)} onSave={async (name, settings) => {
      if (store.project) {
        await window.opencut.projects.settings(store.project.id, settings);
        await store.setProject(await window.opencut.projects.rename(store.project.id, name));
      } else await store.setProject(await window.opencut.projects.create(name, settings));
    }}/>}
    <footer className="workspace-footer"><span><span className="local-dot"/> Local workspace</span><span>OpenCut 0.10.7 · Offline editing & batch export</span></footer>
  </div>;
}
