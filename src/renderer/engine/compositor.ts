import { blendTransition } from './transitions';
import { drawText } from './textRenderer';
import { evaluate } from './keyframes';
import { needsVisualSurface, effectMotion } from './visualEffects';
import { visualSurface } from './visualSurface';
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
  ctx.resetTransform(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.fillStyle = '#08090b'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const track of project.tracks) {
    if (track.hidden || track.kind === 'audio') continue;
    const active = track.clips.filter(clip => activeAt(clip, time));
    if (active.length === 2 && active[1].transitionIn) {
      const [left, right, mixed] = buffers(ctx), transition = active[1].transitionIn;
      drawClip(left, active[0], time, resources); drawClip(right, active[1], time, resources);
      blendTransition(mixed, left.canvas, right.canvas, transition.type, (time - active[1].start) / transition.duration);
      ctx.save(); ctx.globalCompositeOperation = blendMode(active[1]); ctx.drawImage(mixed.canvas, 0, 0); ctx.restore();
    } else for (const clip of active) drawClip(ctx, clip, time, resources);
  }
}
function blendMode(clip: Clip): GlobalCompositeOperation { return clip.blendMode === 'add' ? 'lighter' : clip.blendMode && clip.blendMode !== 'normal' ? clip.blendMode : 'source-over'; }
function drawClip(ctx: CanvasRenderingContext2D, clip: Clip, time: number, resources: RenderResources): void {
  if (clip.type === 'text') { ctx.save(); ctx.globalCompositeOperation = blendMode(clip); drawText(ctx, clip, time); ctx.restore(); return; }
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
      const motion = effectMotion(clip, localTime), reference = height / 1080;
      ctx.globalCompositeOperation = blendMode(clip);
      ctx.globalAlpha = evaluate(clip.opacity, localTime);
      if (clip.blurBackground) {
        const scale = Math.max(width / sw, height / sh) * 1.1;
        ctx.filter = 'blur(24px) brightness(0.5)'; ctx.drawImage(source, (width - sw * scale) / 2, (height - sh * scale) / 2, sw * scale, sh * scale); ctx.filter = 'none';
      }
      const flip = clip.effects.find(effect => effect.type === 'flip' && effect.enabled);
      ctx.translate(evaluate(clip.transform.x, localTime) * width + motion.x * reference, evaluate(clip.transform.y, localTime) * height + motion.y * reference);
      ctx.rotate(evaluate(clip.transform.rotation, localTime) * Math.PI / 180);
      ctx.scale(evaluate(clip.transform.scale, localTime) * motion.scale * (flip?.params.x ? -1 : 1), evaluate(clip.transform.scale, localTime) * motion.scale * (flip?.params.y ? -1 : 1));
      if (clip.frame?.shadow) { ctx.shadowColor = '#000000aa'; ctx.shadowBlur = clip.frame.shadow * reference; ctx.shadowOffsetY = clip.frame.shadow * reference / 3; }
      if (needsVisualSurface(clip)) {
        const surface = visualSurface(ctx, source, clip, { x: sw * crop.l, y: sh * crop.t, width: cropW, height: cropH }, dw, dh, localTime);
        ctx.drawImage(surface, -dw / 2, -dh / 2, dw, dh);
      } else ctx.drawImage(source, sw * crop.l, sh * crop.t, cropW, cropH, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
}
