import type { MediaAsset, MediaClip, Project } from '../../shared/types';
import { constant, editable } from './timeline';
import type { TrackingPoint } from './tracking';

const dimensions = (asset: MediaAsset) => Math.abs(asset.rotation ?? 0) % 180 === 90 ? { width: asset.height!, height: asset.width! } : { width: asset.width!, height: asset.height! };

/** Analyze the uncropped source so subjects outside the destination canvas remain visible. */
export function reframeSource(project: Project, clip: MediaClip): { project: Project; clip: MediaClip } {
  const asset = project.media[clip.mediaId];
  if (asset.kind !== 'video' || !asset.width || !asset.height) throw new Error('A video with known dimensions is required.');
  const size = dimensions(asset);
  const source = structuredClone(clip);
  source.fit = 'stretch'; source.crop = { l: 0, r: 0, t: 0, b: 0 };
  source.transform = { x: constant(.5), y: constant(.5), scale: constant(1), rotation: constant(0) };
  source.opacity = constant(1); source.effects = []; delete source.transitionIn;
  return { clip: source, project: { ...project, settings: { ...project.settings, width: size.width, height: size.height }, tracks: project.tracks.map(track => ({ ...track, clips: track.clips.map(item => item.id === clip.id ? source : item) })) } };
}

export function applyReframe(project: Project, id: string, points: TrackingPoint[]): void {
  const clip = editable(project, id).clip;
  if (clip.type !== 'media') throw new Error('Choose a video clip.');
  const asset = project.media[clip.mediaId];
  if (asset.kind !== 'video' || !asset.width || !asset.height) throw new Error('A video with known dimensions is required.');
  if (points.length < 2 || points[0].time !== clip.start || points.at(-1)!.time !== clip.start + clip.duration - 1 || points.some((p, i) => !Number.isSafeInteger(p.time) || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1 || (i > 0 && p.time <= points[i - 1].time))) throw new Error('Track the complete source before reframing.');
  const size = dimensions(asset), { width, height } = project.settings, scale = Math.max(width / size.width, height / size.height);
  const ratios = { x: size.width * scale / width, y: size.height * scale / height };
  clip.fit = 'fill'; clip.crop = { l: 0, r: 0, t: 0, b: 0 }; clip.blurBackground = false;
  clip.transform = { x: constant(.5), y: constant(.5), scale: constant(1), rotation: constant(0) };
  for (const axis of ['x', 'y'] as const) {
    const ratio = ratios[axis];
    clip.transform[axis].keyframes = points.map(point => ({ time: point.time - clip.start,
      value: Math.max(1 - ratio / 2, Math.min(ratio / 2, .5 + (.5 - point[axis]) * ratio)), easing: 'linear' }));
  }
}
