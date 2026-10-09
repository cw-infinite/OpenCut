import { useState } from 'react';
import { useEditor } from '../state/editor';
import { useProjects } from '../state/projects';
import { MediaResources } from '../engine/resources';
import { renderFrame } from '../engine/compositor';

export function FrameExport(): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const save = async (format: 'png' | 'jpg' | 'cover') => {
    const { project, playhead } = useEditor.getState(); if (!project) return;
    setBusy(true); setMessage(''); useEditor.setState({ playing: false });
    const pool = new MediaResources(useProjects.getState().views);
    try {
      const canvas = document.createElement('canvas'); canvas.width = project.settings.width; canvas.height = project.settings.height;
      await pool.prepare(project, playhead); renderFrame(canvas.getContext('2d')!, project, playhead, pool);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not encode frame')), format === 'jpg' ? 'image/jpeg' : 'image/png', .95));
      const output = await window.opencut.export.image(project.id, format, await blob.arrayBuffer());
      if (output) setMessage(format === 'cover' ? 'Cover saved' : 'Frame saved');
    } catch (error) { useEditor.setState({ error: String(error) }); }
    finally { pool.dispose(); setBusy(false); }
  };
  return <select aria-label="Save current frame" disabled={busy} value="" onChange={event => void save(event.target.value as 'png' | 'jpg' | 'cover')}><option value="">{busy ? 'Saving frame…' : message || 'Save frame'}</option><option value="png">PNG image</option><option value="jpg">JPEG image</option><option value="cover">Use as project cover</option></select>;
}
