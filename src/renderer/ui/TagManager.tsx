import { useEffect, useState } from 'react';
export function TagManager({ onBack, onChanged }: { onBack(): void; onChanged(): Promise<void> }): JSX.Element {
  const [tags, setTags] = useState<string[]>([]), [name, setName] = useState(''), [editing, setEditing] = useState<string | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { void window.opencut.tagCatalog.list().then(setTags).catch(error => setError(String(error))); }, []);
  const change = async (action: 'create' | 'rename' | 'delete', tag: string, replacement?: string) => {
    setBusy(true); setError('');
    try { setTags(await window.opencut.tagCatalog.change(action, tag, replacement)); await onChanged(); setName(''); setEditing(null); } catch (error) { setError(String(error)); } finally { setBusy(false); }
  };
  return <main className="projects-home"><button className="secondary" onClick={onBack}>Back to projects</button><h1>Manage tags</h1><p>Saved tags are available in every project. Renaming or deleting a tag updates its assignments across projects.</p>
    <form onSubmit={event => { event.preventDefault(); void change(editing ? 'rename' : 'create', editing ?? name, editing ? name : undefined); }}><label>{editing ? 'Rename tag' : 'Create tag'}<input aria-label="Tag name" maxLength={40} value={name} disabled={busy} onChange={event => setName(event.target.value)}/></label><button className="primary" disabled={busy || !name.trim()}>{editing ? 'Save tag name' : 'Create tag'}</button>{editing && <button type="button" className="secondary" disabled={busy} onClick={() => { setEditing(null); setName(''); }}>Cancel</button>}</form>
    {error && <p role="alert">{error}</p>}<ul className="project-simple-list">{tags.map(tag => <li key={tag}><span>{tag}</span><div className="project-actions"><button className="secondary" disabled={busy} onClick={() => { setEditing(tag); setName(tag); }}>Rename {tag}</button><button className="secondary" disabled={busy} onClick={() => { if (confirm(`Delete tag “${tag}” from all projects? Projects and media will be kept.`)) void change('delete', tag); }}>Delete {tag}</button></div></li>)}</ul>{!tags.length && <p>No saved tags yet. Create your first tag above.</p>}</main>;
}
