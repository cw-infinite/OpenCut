import { useEffect, useRef, useState, type RefObject, type PointerEvent as ReactPointerEvent } from 'react';
import { useEditor } from '../state/editor';
import { moveSelection } from '../engine/selection';
import { endOf } from '../engine/timeline';
import type { Clip } from '../../shared/types';

export function useTimelineGesture(scroller: RefObject<HTMLDivElement>, scale: number) {
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [invalid, setInvalid] = useState('');
  const cleanup = useRef<() => void>(() => {});
  useEffect(() => () => cleanup.current(), []);
  const start = (event: ReactPointerEvent, clip?: Clip) => {
    if (event.button !== 0) return;
    const node = event.target as HTMLElement;
    if (node.closest('button,input,select,.trim-handle,.keyframe-marker,.transition-handle,.fade-handle')) return;
    if (!clip && (node.closest('.timeline-clip,.track-label,.ruler') || !node.closest('.track-lane,.timeline-content'))) return;
    event.preventDefault(); event.stopPropagation(); cleanup.current();
    (document.activeElement as HTMLElement | null)?.blur();
    const state = useEditor.getState(), project = state.project!, scroll = scroller.current!;
    if (clip && (event.shiftKey || event.ctrlKey)) {
      state.select(state.selected.includes(clip.id) ? state.selected.filter(id => id !== clip.id) : [...state.selected, clip.id]); return;
    }
    const ids = clip ? state.selected.includes(clip.id) ? state.selected : clip.linkId ? project.tracks.flatMap(track => track.clips.filter(item => item.linkId === clip.linkId).map(item => item.id)) : [clip.id] : [];
    const content = scroll.querySelector<HTMLElement>('.timeline-content')!;
    const pointerId = event.pointerId;
    const point = (x: number, y: number) => { const rect = content.getBoundingClientRect(); return { x: x - rect.left, y: y - rect.top }; };
    const origin = point(event.clientX, event.clientY), initialX = event.clientX, initialY = event.clientY;
    // Read clip geometry once. Selection styling does not change layout; scrolling
    // is accounted for by converting the current pointer to content coordinates.
    const rectangles = Array.from(content.querySelectorAll<HTMLElement>('[data-clip-id]')).map(element => {
      const rect = element.getBoundingClientRect(), start = point(rect.left, rect.top);
      return { id: element.dataset.clipId!, left: start.x, top: start.y, right: start.x + rect.width, bottom: start.y + rect.height };
    });
    const lanes = Array.from(content.querySelectorAll<HTMLElement>('[data-track-id]')).map(element => {
      const rect = element.getBoundingClientRect(), start = point(rect.left, rect.top);
      return { id: element.dataset.trackId!, top: start.y, bottom: start.y + rect.height };
    });
    const keep = event.shiftKey || event.ctrlKey ? state.selected : [];
    if (clip) state.select(ids); else state.select(keep);
    useEditor.setState({ playing: false });
    let x = initialX, y = initialY, moved = false, raf = 0, delta = 0, trackDelta = 0, valid = false, last = '';
    const selected = project.tracks.flatMap(track => track.clips.filter(item => ids.includes(item.id)));
    const anchorTrack = clip ? project.tracks.findIndex(track => track.id === clip.trackId) : 0;
    const targets = [state.playhead, ...project.markers.map(marker => marker.time), ...project.tracks.flatMap(track => track.clips.filter(item => !ids.includes(item.id)).flatMap(item => [item.start, endOf(item)]))];
    const update = () => {
      if (!moved) return;
      const rect = scroll.getBoundingClientRect();
      if (x > rect.right - 30) scroll.scrollLeft += Math.min(18, (x - rect.right + 30) / 2);
      else if (x < rect.left + 215) scroll.scrollLeft -= Math.min(18, (rect.left + 215 - x) / 2);
      if (y > rect.bottom - 25) scroll.scrollTop += 12; else if (y < rect.top + 25) scroll.scrollTop -= 12;
      const current = point(x, y);
      if (!clip) {
        const key = `${current.x}:${current.y}`; if (last === key) return; last = key;
        const area = { left: Math.min(origin.x, current.x), top: Math.min(origin.y, current.y), width: Math.abs(current.x - origin.x), height: Math.abs(current.y - origin.y) };
        setBox(area);
        const hit = rectangles.filter(rect => rect.left <= area.left + area.width && rect.right >= area.left && rect.top <= area.top + area.height && rect.bottom >= area.top).map(rect => rect.id);
        const next = [...new Set([...keep, ...hit])];
        if (next.join() !== useEditor.getState().selected.join()) state.select(next);
      } else {
        delta = Math.round((current.x - origin.x) / scale);
        if (state.snap) {
          let correction = 0, distance = 8 / scale;
          for (const item of selected) for (const edge of [item.start, endOf(item)]) for (const target of targets) if (Math.abs(target - edge - delta) < distance) { correction = target - edge - delta; distance = Math.abs(correction); }
          delta += correction;
        }
        delta = Math.max(-Math.min(...selected.map(item => item.start)), delta);
        const lane = lanes.find(lane => current.y >= lane.top && current.y < lane.bottom);
        trackDelta = lane ? project.tracks.findIndex(track => track.id === lane.id) - anchorTrack : 0;
        const key = `${delta}:${trackDelta}`; if (last === key) return; last = key;
        const draft = { ...project, tracks: project.tracks.map(track => ({ ...track, clips: track.clips.map(item => ({ ...item })) })) };
        try { moveSelection(draft, ids, delta, trackDelta); valid = true; setInvalid(''); useEditor.setState({ dragPreview: draft }); }
        catch (error) { valid = false; setInvalid(String(error).replace(/^Error: /, '')); useEditor.setState({ dragPreview: null }); }
      }
    };
    const tick = () => { update(); raf = requestAnimationFrame(tick); };
    const move = (event: PointerEvent) => { if (event.pointerId !== pointerId) return; x = event.clientX; y = event.clientY; if (!moved && Math.hypot(x - initialX, y - initialY) > 3) { moved = true; content.setPointerCapture(pointerId); } };
    const stop = () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key); window.removeEventListener('blur', abort); content.removeEventListener('lostpointercapture', abort); if (content.hasPointerCapture(pointerId)) content.releasePointerCapture(pointerId); setBox(null); setInvalid(''); useEditor.setState({ dragPreview: null }); cleanup.current = () => {}; };
    const finish = (event: PointerEvent) => { if (event.pointerId !== pointerId) return; x = event.clientX; y = event.clientY; update(); if (clip && moved && valid && useEditor.getState().project === project) state.edit(project => moveSelection(project, ids, delta, trackDelta)); else if (!clip && !moved) state.seek(Math.max(0, (origin.x - 185) / scale)); stop(); };
    const abort = () => { if (!clip) state.select(state.selected); stop(); };
    const cancel = (event: PointerEvent) => { if (event.pointerId === pointerId) abort(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); abort(); } };
    cleanup.current = stop;
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', key); window.addEventListener('blur', abort); content.addEventListener('lostpointercapture', abort); raf = requestAnimationFrame(tick);
  };
  return { box, invalid, start };
}
