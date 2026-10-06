import type { Project, Clip, MediaClip } from '../../shared/types';
export interface RenderResources { source(clip: Clip): CanvasImageSource | undefined }
export const activeAt = (clip: Clip, time: number) => time >= clip.start && time < clip.start + clip.duration;
export function sourceTime(clip: MediaClip, time: number): number {
  const offset = (time - clip.start) * clip.speed;
  return Math.max(clip.sourceIn, Math.min(clip.sourceOut - 1, clip.reverse ? clip.sourceOut - offset - 1 : clip.sourceIn + offset));
}
export function renderFrame(ctx: CanvasRenderingContext2D, project: Project, time: number, resources: RenderResources): void {
  const width = ctx.canvas.width, height = ctx.canvas.height;
  ctx.resetTransform(); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.fillStyle = '#08090b'; ctx.fillRect(0, 0, width, height);
  for (const track of project.tracks) {
    if (track.hidden || track.kind === 'audio') continue;
    for (const clip of track.clips) {
      if (!activeAt(clip, time) || clip.type !== 'media') continue;
      const source = resources.source(clip); if (!source) continue;
      const dimensions = source as HTMLVideoElement & HTMLImageElement;
      const sw = dimensions.videoWidth || dimensions.naturalWidth || Number(dimensions.width);
      const sh = dimensions.videoHeight || dimensions.naturalHeight || Number(dimensions.height);
      if (!sw || !sh) continue;
      const crop = clip.crop, cropW = sw * (1 - crop.l - crop.r), cropH = sh * (1 - crop.t - crop.b);
      if (cropW <= 0 || cropH <= 0) continue;
      let dw = width, dh = height;
      if (clip.fit !== 'stretch') {
        const scale = clip.fit === 'fill' ? Math.max(width / cropW, height / cropH) : Math.min(width / cropW, height / cropH);
        dw = cropW * scale; dh = cropH * scale;
      }
      ctx.save();
      ctx.globalAlpha = clip.opacity.value;
      if (clip.blurBackground) {
        const scale = Math.max(width / sw, height / sh) * 1.1;
        ctx.filter = 'blur(24px) brightness(0.5)'; ctx.drawImage(source, (width - sw * scale) / 2, (height - sh * scale) / 2, sw * scale, sh * scale); ctx.filter = 'none';
      }
      const flip = clip.effects.find(effect => effect.type === 'flip' && effect.enabled);
      ctx.translate(clip.transform.x.value * width, clip.transform.y.value * height);
      ctx.rotate(clip.transform.rotation.value * Math.PI / 180);
      ctx.scale(clip.transform.scale.value * (flip?.params.x ? -1 : 1), clip.transform.scale.value * (flip?.params.y ? -1 : 1));
      ctx.drawImage(source, sw * crop.l, sh * crop.t, cropW, cropH, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  }
}
