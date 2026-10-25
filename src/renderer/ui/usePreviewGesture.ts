import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { alignPreview, type AlignmentGuide } from '../engine/previewAlignment';
import { useEditor } from '../state/editor';
import { activeAt } from '../engine/compositor';
import { editable } from '../engine/timeline';
import { evaluate, setAnimatedValue } from '../engine/keyframes';
import type { Clip } from '../../shared/types';

export function usePreviewGesture(canvas: RefObject<HTMLCanvasElement>) {
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const cleanup = useRef<() => void>(() => {});
  useEffect(() => () => cleanup.current(), []);
  const gesture = (event: ReactPointerEvent, mode: 'move' | 'scale' | 'rotation' = 'move') => {
    const state = useEditor.getState(), project = state.project;
    if (event.button !== 0 || !project || !state.selected.length || !canvas.current) return;
    const selected = project.tracks.flatMap(track => track.clips.filter(clip => state.selected.includes(clip.id)).map(clip => ({ clip, track })));
    if (selected.length !== state.selected.length || selected.some(({ track }) => track.locked || track.hidden || track.kind === 'audio')) return;
    if (selected.length > 1 && (mode !== 'move' || selected.some(({ clip }) => clip.type !== 'text'))) return;
    const clip = selected.find(({ clip }) => activeAt(clip, state.playhead))?.clip;
    if (!clip) return;
    const positions = new Map(selected.map(({ clip }) => {
      const time = Math.max(0, Math.min(clip.duration, state.playhead - clip.start));
      return [clip.id, { time, x: evaluate(clip.transform.x, time), y: evaluate(clip.transform.y, time) }];
    }));
    const values = [...positions.values()];
    const anchors = selected.filter(({ clip }) => activeAt(clip, state.playhead)).map(({ clip }) => positions.get(clip.id)!);
    const targets = project.tracks.filter(track => !track.hidden && track.kind !== 'audio').flatMap(track => track.clips.filter(item => !positions.has(item.id) && activeAt(item, state.playhead)).map(item => ({ x: evaluate(item.transform.x, state.playhead - item.start), y: evaluate(item.transform.y, state.playhead - item.start) })));
    const limits = { minX: Math.max(...values.map(value => -2 - value.x)), maxX: Math.min(...values.map(value => 3 - value.x)), minY: Math.max(...values.map(value => -2 - value.y)), maxY: Math.min(...values.map(value => 3 - value.y)) };
    event.preventDefault(); event.stopPropagation(); cleanup.current();
    (document.activeElement as HTMLElement | null)?.blur();
    useEditor.setState({ playing: false });
    const node = canvas.current.parentElement!, pointerId = event.pointerId, rect = canvas.current.getBoundingClientRect();
    const time = state.playhead - clip.start, sx = event.clientX, sy = event.clientY;
    const initial = Object.fromEntries(Object.entries(clip.transform).map(([key, property]) => [key, evaluate(property, time)])) as Record<keyof Clip['transform'], number>;
    const cx = rect.left + initial.x * rect.width, cy = rect.top + initial.y * rect.height;
    const distance = Math.max(1, Math.hypot(sx - cx, sy - cy)), angle = Math.atan2(sy - cy, sx - cx);
    let x = sx, y = sy, raf = 0, moved = false, last = '', free = event.altKey;
    const movement = () => alignPreview(anchors, targets, {
      x: Math.max(limits.minX, Math.min(limits.maxX, (x - sx) / rect.width)),
      y: Math.max(limits.minY, Math.min(limits.maxY, (y - sy) / rect.height)),
    }, rect, free);
    const apply = (target: Clip) => {
      if (mode === 'move') {
        const start = positions.get(target.id)!;
        const delta = movement();
        const dx = Math.max(limits.minX, Math.min(limits.maxX, delta.x));
        const dy = Math.max(limits.minY, Math.min(limits.maxY, delta.y));
        setAnimatedValue(target.transform.x, start.time, start.x + dx);
        setAnimatedValue(target.transform.y, start.time, start.y + dy);
      } else if (mode === 'scale') setAnimatedValue(target.transform.scale, time, Math.max(.01, Math.min(10, initial.scale * Math.hypot(x - cx, y - cy) / distance)));
      else {
        const delta = Math.atan2(Math.sin(Math.atan2(y - cy, x - cx) - angle), Math.cos(Math.atan2(y - cy, x - cx) - angle));
        setAnimatedValue(target.transform.rotation, time, Math.max(-360, Math.min(360, initial.rotation + delta * 180 / Math.PI)));
      }
    };
    const update = () => {
      raf = 0; if (!moved || last === `${x}:${y}:${free}`) return; last = `${x}:${y}:${free}`;
      setAlignmentGuides(mode === 'move' ? movement().guides : []);
      const preview = { ...project, tracks: project.tracks.map(track => ({ ...track, clips: track.clips.map(item => positions.has(item.id) ? { ...item, transform: structuredClone(item.transform) } : item) })) };
      for (const { clip } of selected) apply(editable(preview, clip.id).clip); useEditor.setState({ dragPreview: preview });
    };
    const stop = () => {
      cancelAnimationFrame(raf); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key); window.removeEventListener('blur', stop); node.removeEventListener('lostpointercapture', stop);
      if (node.hasPointerCapture(pointerId)) node.releasePointerCapture(pointerId);
      useEditor.setState({ dragPreview: null }); setAlignmentGuides([]); cleanup.current = () => {};
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return; x = event.clientX; y = event.clientY; free = event.altKey;
      if (!moved && Math.hypot(x - sx, y - sy) > 2) { moved = true; node.setPointerCapture(pointerId); }
      if (moved && !raf) raf = requestAnimationFrame(update);
    };
    const finish = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return; x = event.clientX; y = event.clientY; free = event.altKey;
      if (moved && useEditor.getState().project === project) state.edit(project => { for (const { clip } of selected) apply(editable(project, clip.id).clip); });
      stop();
    };
    const cancel = (event: PointerEvent) => { if (event.pointerId === pointerId) stop(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); stop(); } };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', key); window.addEventListener('blur', stop); node.addEventListener('lostpointercapture', stop);
    cleanup.current = stop;
  };
  return { gesture, alignmentGuides };
}
