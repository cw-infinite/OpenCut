import type { Clip } from '../../shared/types';
import { useEditor } from '../state/editor';
import { editable } from '../engine/timeline';
import { visualProperty } from '../engine/keyframes';

const properties = (clip: Clip) => [...(['x', 'y', 'scale', 'rotation', 'opacity'] as const).map(name => visualProperty(clip, name)), ...(clip.type === 'media' ? [clip.volume] : [])];

export function KeyframeMarkers({ clip, scale }: { clip: Clip; scale: number }): JSX.Element {
  const state = useEditor();
  const times = [...new Set(properties(clip).flatMap(value => value.keyframes.map(key => key.time)))].filter(time => time >= 0 && time <= clip.duration);
  const move = (event: React.PointerEvent, time: number) => {
    event.stopPropagation(); event.preventDefault();
    const start = event.clientX;
    const finish = (end: PointerEvent) => {
      const next = Math.max(0, Math.min(clip.duration, Math.round(time + (end.clientX - start) / scale)));
      if (Math.abs(end.clientX - start) < 3) { state.seek(clip.start + time); return; }
      state.edit(project => {
        const current = editable(project, clip.id).clip;
        for (const property of properties(current)) {
          const key = property.keyframes.find(key => key.time === time);
          if (key) {
            if (property.keyframes.some(other => other !== key && other.time === next)) throw new Error('A keyframe already exists at that time');
            key.time = next; property.keyframes.sort((a, b) => a.time - b.time);
          }
        }
      });
    };
    window.addEventListener('pointerup', finish, { once: true });
  };
  return <>{times.map(time => <button key={time} className="clip-keyframe" style={{ left: time * scale }}
    aria-label={`Keyframe at ${(time / 1e6).toFixed(3)} seconds`} title="Click to seek; drag to move; right-click to remove"
    onDoubleClick={event => event.stopPropagation()} onContextMenu={event => {
      event.preventDefault(); event.stopPropagation(); state.edit(project => {
        for (const property of properties(editable(project, clip.id).clip)) property.keyframes = property.keyframes.filter(key => key.time !== time);
      });
    }}
    draggable={false} onDragStart={event => { event.preventDefault(); event.stopPropagation(); }}
    onClick={event => event.stopPropagation()} onPointerDown={event => move(event, time)}>◆</button>)}</>;
}
