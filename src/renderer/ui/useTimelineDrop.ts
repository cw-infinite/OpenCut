import { useEffect, useState, type DragEvent } from 'react';
import { useEditor } from '../state/editor';
import { endOf, snapTime } from '../engine/timeline';

export function useTimelineDrop(scale: number) {
  const [hint, setHint] = useState<{ key: string; start: number; duration: number; newTrack: boolean } | null>(null);
  useEffect(() => {
    const clear = () => { setHint(null); useEditor.setState({ dragItem: null }); };
    window.addEventListener('dragend', clear); window.addEventListener('drop', clear);
    return () => { window.removeEventListener('dragend', clear); window.removeEventListener('drop', clear); };
  }, []);
  const accepts = (event: DragEvent) => ['application/opencut-media', 'application/opencut-text'].some(type => event.dataTransfer.types.includes(type));
  const destination = (event: DragEvent<HTMLElement>, trackId?: string, index?: number) => {
    const state = useEditor.getState(), project = state.project!;
    const mediaId = event.dataTransfer.getData('application/opencut-media');
    const item = mediaId ? { kind: 'media' as const, id: mediaId } : event.dataTransfer.getData('application/opencut-text') ? { kind: 'text' as const } : state.dragItem;
    const media = item?.kind === 'media' ? project.media[item.id] : undefined;
    const kind = item?.kind === 'text' ? 'text' : media?.kind === 'audio' ? 'audio' : 'video';
    const track = project.tracks.find(track => track.id === trackId);
    const compatible = track?.kind === kind || (track?.kind === 'audio' && media?.hasAudio);
    const raw = Math.max(0, Math.round((event.clientX - event.currentTarget.getBoundingClientRect().left) / scale));
    const start = state.snap ? snapTime(raw, [state.playhead, ...project.markers.map(marker => marker.time), ...project.tracks.flatMap(track => track.clips.flatMap(clip => [clip.start, endOf(clip)]))], 8 / scale) : raw;
    return { item, track, start: Math.max(0, Math.round(start)), duration: media?.duration ?? 5e6, trackId: compatible ? trackId : undefined, index: track && !compatible ? project.tracks.indexOf(track) + 1 : index };
  };
  return {
    hint,
    handlers: (key: string, trackId?: string, index?: number) => ({
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!accepts(event)) return; event.preventDefault(); event.stopPropagation();
        const target = destination(event, trackId, index); event.dataTransfer.dropEffect = target.track?.locked ? 'none' : 'copy';
        const next = { key, start: target.start, duration: target.duration, newTrack: !target.trackId };
        setHint(previous => previous?.key === key && previous.start === next.start && previous.duration === next.duration ? previous : next);
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHint(null); },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (!accepts(event)) return; event.preventDefault(); event.stopPropagation(); setHint(null);
        const target = destination(event, trackId, index); useEditor.setState({ dragItem: null });
        if (target.track?.locked) { useEditor.setState({ error: 'Track is locked' }); return; }
        if (target.item?.kind === 'text') useEditor.getState().addText(target.trackId, target.start, target.index);
        else if (target.item?.kind === 'media') useEditor.getState().addMedia(target.item.id, target.trackId, target.start, target.index);
      }
    })
  };
}
