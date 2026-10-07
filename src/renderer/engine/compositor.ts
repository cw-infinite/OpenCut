import { blendTransition } from './transitions';
import { drawText } from './textRenderer';
import { evaluate } from './keyframes';
import type { Project, Clip, MediaClip } from '../../shared/types';
export interface RenderResources { source(clip: Clip): CanvasImageSource | undefined }
export const activeAt = (clip: Clip, time: number) => time >= clip.start && time < clip.start + clip.duration;
export function sourceTime(clip: MediaClip, time: number): number {
  const offset = (time - clip.start) * clip.speed;
  return Math.max(clip.sourceIn, Math.min(clip.sourceOut - 1, clip.reverse ? clip.sourceOut - offset - 1 : clip.sourceIn + offset));
}
const surfaces = new WeakMap<CanvasRenderingContext2D, CanvasRenderingContext2D[]>();
function buffers(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D[] {
  let list = surfaces.get(ctx);
  if (!list) { list = Array.from({ length: 3 }, () => document.createElement('canvas').getContext('2d')!); surfaces.set(ctx, list); }
  for (const surface of list) {
    if (surface.canvas.width !== ctx.canvas.width || surface.canvas.height !== ctx.canvas.height) { surface.canvas.width = ctx.canvas.width; surface.canvas.height = ctx.canvas.height; }
    surface.resetTransform(); surface.clearRect(0, 0, surface.canvas.width, surface.canvas.height);
  }
  return list;
}
export function renderFrame(ctx: CanvasRenderingContext2D, project: Project, time: number, resources: RenderResources): void {
  ctx.resetTransform(); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.fillStyle = '#08090b'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const track of project.tracks) {
    if (track.hidden || track.kind === 'audio') continue;
    const active = track.clips.filter(clip => activeAt(clip, time));
    if (active.length === 2 && active[1].transitionIn) {
      const [left, right, mixed] = buffers(ctx), transition = active[1].transitionIn;
      drawClip(left, active[0], time, resources); drawClip(right, active[1], time, resources);
      blendTransition(mixed, left.canvas, right.canvas, transition.type, (time - active[1].start) / transition.duration);
      ctx.drawImage(mixed.canvas, 0, 0);
    } else for (const clip of active) drawClip(ctx, clip, time, resources);
  }
}
function drawClip(ctx: CanvasRenderingContext2D, clip: Clip, time: number, resources: RenderResources): void {
  if (clip.type === 'text') { drawText(ctx, clip, time); return; }
  const width = ctx.canvas.width, height = ctx.canvas.height;
      const source = resources.source(clip); if (!source) return;
      const dimensions = source as HTMLVideoElement & HTMLImageElement;
      const sw = dimensions.videoWidth || dimensions.naturalWidth || Number(dimensions.width);
      const sh = dimensions.videoHeight || dimensions.naturalHeight || Number(dimensions.height);
      if (!sw || !sh) return;
      const crop = clip.crop, cropW = sw * (1 - crop.l - crop.r), cropH = sh * (1 - crop.t - crop.b);
      if (cropW <= 0 || cropH <= 0) return;
      let dw = width, dh = height;
      if (clip.fit !== 'stretch') {
        const scale = clip.fit === 'fill' ? Math.max(width / cropW, height / cropH) : Math.min(width / cropW, height / cropH);
        dw = cropW * scale; dh = cropH * scale;
      }
      ctx.save();
      const localTime = time - clip.start;
      ctx.globalAlpha = evaluate(clip.opacity, localTime);
      if (clip.blurBackground) {
        const scale = Math.max(width / sw, height / sh) * 1.1;
        ctx.filter = 'blur(24px) brightness(0.5)'; ctx.drawImage(source, (width - sw * scale) / 2, (height - sh * scale) / 2, sw * scale, sh * scale); ctx.filter = 'none';
      }
      const flip = clip.effects.find(effect => effect.type === 'flip' && effect.enabled);
      ctx.translate(evaluate(clip.transform.x, localTime) * width, evaluate(clip.transform.y, localTime) * height);
      ctx.rotate(evaluate(clip.transform.rotation, localTime) * Math.PI / 180);
      ctx.scale(evaluate(clip.transform.scale, localTime) * (flip?.params.x ? -1 : 1), evaluate(clip.transform.scale, localTime) * (flip?.params.y ? -1 : 1));
      ctx.drawImage(source, sw * crop.l, sh * crop.t, cropW, cropH, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
}
