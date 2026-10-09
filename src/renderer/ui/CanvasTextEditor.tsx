import { useState } from 'react';
import type { TextClip } from '../../shared/types';
import { useEditor } from '../state/editor';
import { editable } from '../engine/timeline';

export function CanvasTextEditor({ clip, onClose }: { clip: TextClip; onClose(): void }): JSX.Element {
  const [value, setValue] = useState(clip.content), state = useEditor();
  const save = () => { state.edit(project => { const current = editable(project, clip.id).clip; if (current.type === 'text') { current.content = value; if (current.caption) current.caption.words = []; } }); onClose(); };
  return <div className="canvas-text-editor" onPointerDown={event => event.stopPropagation()}>
    <textarea autoFocus aria-label="Edit text on canvas" value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => {
      event.stopPropagation(); if (event.key === 'Escape') onClose(); if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) save();
    }}/><div><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={save}>Apply text</button></div>
  </div>;
}
