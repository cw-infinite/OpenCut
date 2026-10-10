import { useEffect, useState } from 'react';
import type { MediaClip } from '../../shared/types';
import { useEditor } from '../state/editor';
import { useProjects } from '../state/projects';
import { editable } from '../engine/timeline';

export function CreativeDialog({ clip, onClose }: { clip?: MediaClip; onClose(): void }): JSX.Element {
  const kind = clip ? 'background' : 'speech';
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [setup, setSetup] = useState(false);
  const [text, setText] = useState(''), [rate, setRate] = useState(1), [error, setError] = useState('');
  const [progress, setProgress] = useState<{ stage: string; percent: number | null } | null>(null);
  useEffect(() => { void window.opencut.creative.status().then(status => setReady(status[kind])).catch(error => setError(String(error))); return window.opencut.creative.onProgress(setProgress); }, [kind]);
  const download = async () => {
    setBusy(true); setSetup(true); setError('');
    try { setReady((await window.opencut.creative.setup(kind))[kind]); }
    catch (error) { setError(String(error)); }
    finally { setBusy(false); setSetup(false); }
  };
  const generate = async () => {
    setBusy(true); setError(''); setProgress(null);
    const snapshot = useEditor.getState(), original = snapshot.project!;
    useEditor.setState({ playing: false });
    try {
      await window.opencut.projects.saveEdit(original);
      const asset = await window.opencut.creative.generate({ kind, projectId: original.id, clipId: clip?.id, text, rate });
      const current = useEditor.getState(); if (current.project?.id !== original.id) return;
      useEditor.setState({ project: { ...current.project, media: { ...current.project.media, [asset.id]: asset } } });
      useProjects.setState({ views: await window.opencut.media.views(original.id) });
      if (clip) current.edit(project => {
        const target = editable(project, clip.id).clip;
        if (JSON.stringify(target) !== JSON.stringify(clip) || target.type !== 'media') throw new Error('Clip changed during processing. The cutout is available in the media library.');
        target.mediaId = asset.id; target.sourceIn = 0; target.sourceOut = target.duration * target.speed;
      });
      else current.addMedia(asset.id, undefined, snapshot.playhead);
      if (useEditor.getState().error) throw new Error(useEditor.getState().error!);
      onClose();
    } catch (error) { setError(String(error)); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop"><section className="modal creative-modal" role="dialog" aria-modal="true" aria-label={clip ? 'Remove background' : 'Text to speech'}>
    <h2>{clip ? 'Remove portrait background' : 'Text to speech'}</h2>
    <p>{clip ? 'Creates a transparent copy using the local MODNet portrait model. Best for people; review hair, hands and moving edges. Video source ranges are limited to 30 seconds. Undo restores the original.' : 'Create a voiceover with the local Piper US English voice (LJ Speech). Audio is added at the playhead and can be edited like any audio clip.'}</p>
    {!ready && <><p>Download the {clip ? 'portrait model (26 MB)' : 'speech engine and voice (86 MB)'} once. Generation then works offline.</p><button disabled={busy} onClick={() => void download()}>Download {clip ? 'portrait model' : 'speech tools'}</button></>}
    {!clip && <><label>Speech text<textarea aria-label="Speech text" rows={6} maxLength={5000} value={text} disabled={busy} onChange={event => setText(event.target.value)}/></label><label>Speech speed<select aria-label="Speech speed" value={rate} disabled={busy} onChange={event => setRate(Number(event.target.value))}>{[.5, .75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label></>}
    {busy && <p role="status">{progress?.stage ?? 'Preparing'}{progress?.percent != null ? ` · ${progress.percent}%` : '…'}</p>}
    {error && <p role="alert">{error}</p>}
    <div className="inspector-buttons"><button disabled={busy} onClick={onClose}>Close</button><button className="primary" disabled={busy || !ready || (!clip && !text.trim())} onClick={() => void generate()}>{clip ? 'Remove background' : 'Generate speech'}</button>{busy && !setup && <button onClick={() => void window.opencut.creative.cancel()}>Cancel processing</button>}</div>
  </section></div>;
}
