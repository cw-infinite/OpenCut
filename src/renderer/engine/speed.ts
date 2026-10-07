import type { Clip, MediaClip, Project } from '../../shared/types';

function gcd(a: number, b: number): number { while (b) [a, b] = [b, a % b]; return a; }
export function speedRatio(speed: number): { numerator: number; denominator: number } {
  if (!Number.isFinite(speed) || speed < .1 || speed > 100) throw new Error('Speed must be between 0.1 and 100');
  const numerator = Math.round(speed * 100), divisor = gcd(numerator, 100);
  if (Math.abs(numerator / 100 - speed) > 1e-9) throw new Error('Speed supports two decimal places');
  return { numerator: numerator / divisor, denominator: 100 / divisor };
}
export function quantizeOffset(clip: Clip, offset: number): number {
  if (clip.type !== 'media') return Math.round(offset);
  const { denominator } = speedRatio(clip.speed);
  return Math.round(offset / denominator) * denominator;
}
export function changeSpeed(project: Project, id: string, speed: number): void {
  const ratio = speedRatio(speed);
  const selected = project.tracks.flatMap(track => track.clips).find(clip => clip.id === id);
  if (selected?.type !== 'media') throw new Error('Select a media clip');
  const targets = project.tracks.flatMap(track => track.clips).filter(clip => clip.id === id || (selected.linkId && clip.linkId === selected.linkId));
  for (const target of targets) {
    if (target.type !== 'media') continue;
    const clip: MediaClip = target, track = project.tracks.find(track => track.id === clip.trackId)!;
    if (track.locked) throw new Error('Track is locked');
    if (project.media[clip.mediaId].kind === 'image') throw new Error('Still images do not have a playback speed');
    const oldEnd = clip.start + clip.duration;
    const units = Math.floor((clip.sourceOut - clip.sourceIn) / ratio.numerator);
    if (units < 1) throw new Error('Clip is too short for this speed');
    const duration = units * ratio.denominator, span = units * ratio.numerator;
    if (clip.reverse) clip.sourceIn = clip.sourceOut - span; else clip.sourceOut = clip.sourceIn + span;
    clip.duration = duration; clip.speed = speed;
    clip.fadeIn = Math.min(clip.fadeIn, duration); clip.fadeOut = Math.min(clip.fadeOut, duration);
    const delta = clip.start + duration - oldEnd;
    for (const following of track.clips) if (following.id !== clip.id && following.start > clip.start) following.start += delta;
  }
}
