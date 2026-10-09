import type { MediaClip } from '../../shared/types';
import { useEditor } from '../state/editor';
import { editable } from '../engine/timeline';

export function FadeHandles({ clip, scale }: { clip: MediaClip; scale: number }): JSX.Element {
  const state = useEditor();
  return <>{(['fadeIn', 'fadeOut'] as const).map(key => <button key={key} className="audio-fade-handle" aria-label={key === 'fadeIn' ? 'Drag audio fade in' : 'Drag audio fade out'}
    style={{ left: (key === 'fadeIn' ? clip.fadeIn : clip.duration - clip.fadeOut) * scale }} title="Drag to adjust audio fade" draggable={false}
    onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onDragStart={event => { event.preventDefault(); event.stopPropagation(); }}
    onPointerDown={event => {
      event.preventDefault(); event.stopPropagation(); const x = event.clientX;
      window.addEventListener('pointerup', end => state.edit(project => { const current = editable(project, clip.id).clip as MediaClip; current[key] = Math.round(Math.max(0, Math.min(current.duration, clip[key] + (end.clientX - x) / scale * (key === 'fadeIn' ? 1 : -1)))); }), { once: true });
    }}>◢</button>)}</>;
}
