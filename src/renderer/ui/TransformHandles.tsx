import { evaluate } from '../engine/keyframes';
import { useEffect, useState, type RefObject } from 'react';
import { useEditor } from '../state/editor';
import { activeAt } from '../engine/compositor';

export function TransformHandles({ canvas, gesture }: { canvas: RefObject<HTMLCanvasElement>; gesture(event: React.PointerEvent, mode: 'scale' | 'rotation'): void }): JSX.Element | null {
  const state = useEditor(), project = state.dragPreview ?? state.project!;
  const clip = project.tracks.flatMap(track => track.clips).find(clip => clip.id === state.selected[0]);
  const [bounds, setBounds] = useState({ x: 0, y: 0, width: 0, height: 0 });
  useEffect(() => {
    const element = canvas.current; if (!element) return;
    const update = () => { const rect = element.getBoundingClientRect(), parent = element.parentElement!.getBoundingClientRect(); setBounds({ x: rect.x - parent.x, y: rect.y - parent.y, width: rect.width, height: rect.height }); };
    const observer = new ResizeObserver(update); observer.observe(element); update(); return () => observer.disconnect();
  }, [canvas]);
  if (!clip || state.selected.length !== 1 || !activeAt(clip, state.playhead)) return null;
  const asset = clip.type === 'media' ? project.media[clip.mediaId] : { kind: 'text', width: project.settings.width * clip.style.maxWidthFraction, height: clip.style.fontSize * clip.style.lineHeight * clip.content.split('\n').length, rotation: 0 };
  if (asset.kind === 'audio') return null;
  const rotated = Math.abs(asset.rotation ?? 0) % 180 === 90;
  const width = (rotated ? asset.height : asset.width) ?? project.settings.width;
  const height = (rotated ? asset.width : asset.height) ?? project.settings.height;
  const ratio = clip.type === 'media' ? width * (1 - clip.crop.l - clip.crop.r) / (height * (1 - clip.crop.t - clip.crop.b)) : width / height;
  let w = bounds.width, h = bounds.height;
  if (clip.type === 'text') { w = width / project.settings.width * bounds.width; h = height / project.settings.height * bounds.height; }
  else if (clip.fit !== 'stretch') { const fitWidth = bounds.width / ratio <= bounds.height; if (fitWidth === (clip.fit === 'fit')) h = w / ratio; else w = h * ratio; }
  const time = state.playhead - clip.start;
  return <div className={'transform-box ' + (clip.type === 'text' ? 'text-transform' : '')} style={{ left: bounds.x + evaluate(clip.transform.x, time) * bounds.width, top: bounds.y + evaluate(clip.transform.y, time) * bounds.height,
    width: w * evaluate(clip.transform.scale, time), height: h * evaluate(clip.transform.scale, time), transform: `translate(-50%,-50%) rotate(${evaluate(clip.transform.rotation, time)}deg)` }}>
    <button className="scale-handle" title="Drag to scale" aria-label="Scale selected clip" onPointerDown={event => gesture(event, 'scale')}/>
    <button className="rotate-handle" title="Drag to rotate" aria-label="Rotate selected clip" onPointerDown={event => gesture(event, 'rotation')}/>
  </div>;
}
