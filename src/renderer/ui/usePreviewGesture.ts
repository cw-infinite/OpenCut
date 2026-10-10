import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { useEditor } from '../state/editor';
import { activeAt } from '../engine/compositor';
import { editable } from '../engine/timeline';
import { evaluate, setAnimatedValue } from '../engine/keyframes';
import type { Clip } from '../../shared/types';

export function usePreviewGesture(canvas: RefObject<HTMLCanvasElement>) {
  const cleanup = useRef<() => void>(() => {});
  useEffect(() => () => cleanup.current(), []);
  return (event: ReactPointerEvent, mode: 'move' | 'scale' | 'rotation' = 'move') => {
    const state = useEditor.getState(), project = state.project;
    if (event.button !== 0 || !project || state.selected.length !== 1 || !canvas.current) return;
    const track = project.tracks.find(track => track.clips.some(clip => clip.id === state.selected[0]));
    const clip = track?.clips.find(clip => clip.id === state.selected[0]);
    if (!clip || track?.locked || track?.hidden || track?.kind === 'audio' || !activeAt(clip, state.playhead)) return;
    event.preventDefault(); event.stopPropagation(); cleanup.current();
    (document.activeElement as HTMLElement | null)?.blur();
    useEditor.setState({ playing: false });
    const node = canvas.current.parentElement!, pointerId = event.pointerId, rect = canvas.current.getBoundingClientRect();
    const time = state.playhead - clip.start, sx = event.clientX, sy = event.clientY;
    const initial = Object.fromEntries(Object.entries(clip.transform).map(([key, property]) => [key, evaluate(property, time)])) as Record<keyof Clip['transform'], number>;
    const cx = rect.left + initial.x * rect.width, cy = rect.top + initial.y * rect.height;
    const distance = Math.max(1, Math.hypot(sx - cx, sy - cy)), angle = Math.atan2(sy - cy, sx - cx);
    let x = sx, y = sy, raf = 0, moved = false, last = '';
    const apply = (target: Clip) => {
      if (mode === 'move') {
        setAnimatedValue(target.transform.x, time, Math.max(-2, Math.min(3, initial.x + (x - sx) / rect.width)));
        setAnimatedValue(target.transform.y, time, Math.max(-2, Math.min(3, initial.y + (y - sy) / rect.height)));
      } else if (mode === 'scale') setAnimatedValue(target.transform.scale, time, Math.max(.01, Math.min(10, initial.scale * Math.hypot(x - cx, y - cy) / distance)));
      else {
        const delta = Math.atan2(Math.sin(Math.atan2(y - cy, x - cx) - angle), Math.cos(Math.atan2(y - cy, x - cx) - angle));
        setAnimatedValue(target.transform.rotation, time, Math.max(-360, Math.min(360, initial.rotation + delta * 180 / Math.PI)));
      }
    };
    const update = () => {
      raf = 0; if (!moved || last === `${x}:${y}`) return; last = `${x}:${y}`;
      const preview = { ...project, tracks: project.tracks.map(track => ({ ...track, clips: track.clips.map(item => item.id === clip.id ? { ...item, transform: structuredClone(item.transform) } : item) })) };
      apply(editable(preview, clip.id).clip); useEditor.setState({ dragPreview: preview });
    };
    const stop = () => {
      cancelAnimationFrame(raf); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key); window.removeEventListener('blur', stop); node.removeEventListener('lostpointercapture', stop);
      if (node.hasPointerCapture(pointerId)) node.releasePointerCapture(pointerId);
      useEditor.setState({ dragPreview: null }); cleanup.current = () => {};
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return; x = event.clientX; y = event.clientY;
      if (!moved && Math.hypot(x - sx, y - sy) > 2) { moved = true; node.setPointerCapture(pointerId); }
      if (moved && !raf) raf = requestAnimationFrame(update);
    };
    const finish = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return; x = event.clientX; y = event.clientY;
      if (moved && useEditor.getState().project === project) state.edit(project => apply(editable(project, clip.id).clip));
      stop();
    };
    const cancel = (event: PointerEvent) => { if (event.pointerId === pointerId) stop(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); stop(); } };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', key); window.addEventListener('blur', stop); node.addEventListener('lostpointercapture', stop);
    cleanup.current = stop;
  };
}
