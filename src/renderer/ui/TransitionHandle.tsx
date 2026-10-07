import type { Clip } from '../../shared/types';
import { useEditor } from '../state/editor';
import { applyTransition } from '../engine/transitions';

export function TransitionHandle({ clip, scale }: { clip: Clip; scale: number }): JSX.Element | null {
  const state = useEditor(), transition = clip.transitionIn;
  if (!transition) return null;
  return <button className="transition-handle" style={{ width: transition.duration * scale }} aria-label="Drag transition duration" title={`${transition.type}: ${(transition.duration / 1e6).toFixed(2)}s`} draggable={false}
    onDragStart={event => { event.preventDefault(); event.stopPropagation(); }} onClick={event => event.stopPropagation()} onPointerDown={event => {
      event.preventDefault(); event.stopPropagation(); const start = event.clientX;
      window.addEventListener('pointerup', end => state.edit(project => applyTransition(project, clip.id, transition.type, Math.max(1000, Math.round(transition.duration + (end.clientX - start) / scale)))), { once: true });
    }}>↔</button>;
}
