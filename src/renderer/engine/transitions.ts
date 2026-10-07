import type { Project, Transition } from '../../shared/types';

export const transitionTypes: Transition['type'][] = ['fade', 'dissolve', 'slideLeft', 'slideRight', 'slideUp', 'slideDown', 'wipeLeft', 'wipeRight', 'zoomIn', 'zoomOut', 'blur', 'flash'];
export function applyTransition(project: Project, id: string, type: Transition['type'] | 'none', duration: number): void {
  const track = project.tracks.find(track => track.clips.some(clip => clip.id === id));
  if (!track || track.locked || track.kind !== 'video') throw new Error('Select an unlocked video track');
  const index = track.clips.findIndex(clip => clip.id === id), clip = track.clips[index], previous = track.clips[index - 1];
  if (!previous) throw new Error('A transition needs a preceding clip');
  const old = clip.transitionIn?.duration ?? 0;
  if (clip.start !== previous.start + previous.duration - old) throw new Error('Close the gap before adding a transition');
  if (track.clips.slice(index).some(clip => clip.linkId)) throw new Error('Unlink affected clips before changing transition overlap');
  const next = type === 'none' ? 0 : Math.round(duration);
  const maximum = Math.min(previous.duration - (previous.transitionIn?.duration ?? 0), clip.duration - (track.clips[index + 1]?.transitionIn?.duration ?? 0));
  if (type !== 'none' && (!transitionTypes.includes(type) || !Number.isSafeInteger(next) || next <= 0 || next > maximum)) throw new Error('Transition is too long for the adjacent clips');
  for (const following of track.clips.slice(index)) following.start += old - next;
  if (type === 'none') delete clip.transitionIn; else clip.transitionIn = { type, duration: next };
}
export function applyDefaultTransitions(project: Project): void {
  for (const track of project.tracks) {
    if (track.locked || track.kind !== 'video') continue;
    for (let index = 1; index < track.clips.length; index++) {
      const clip = track.clips[index], previous = track.clips[index - 1];
      if (clip.transitionIn || clip.start !== previous.start + previous.duration) continue;
      const duration = Math.min(500000, Math.floor(previous.duration / 3), Math.floor(clip.duration / 3));
      if (duration > 0) applyTransition(project, clip.id, 'dissolve', duration);
    }
  }
}

export function blendTransition(ctx: CanvasRenderingContext2D, left: CanvasImageSource, right: CanvasImageSource, type: Transition['type'], progress: number): void {
  const p = Math.max(0, Math.min(1, progress)), w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.save();
  if (type.startsWith('slide')) {
    const dx = type === 'slideLeft' ? -w : type === 'slideRight' ? w : 0;
    const dy = type === 'slideUp' ? -h : type === 'slideDown' ? h : 0;
    ctx.drawImage(left, dx * p, dy * p); ctx.drawImage(right, dx * (p - 1), dy * (p - 1));
  } else if (type.startsWith('wipe')) {
    ctx.drawImage(left, 0, 0); ctx.beginPath(); ctx.rect(type === 'wipeLeft' ? w * (1 - p) : 0, 0, w * p, h); ctx.clip(); ctx.drawImage(right, 0, 0);
  } else if (type === 'fade') {
    ctx.fillStyle = '#08090b'; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = Math.abs(2 * p - 1); ctx.drawImage(p < .5 ? left : right, 0, 0);
  } else {
    ctx.globalCompositeOperation = 'lighter';
    const draw = (source: CanvasImageSource, alpha: number, zoom: number) => {
      ctx.globalAlpha = alpha; ctx.drawImage(source, w * (1 - zoom) / 2, h * (1 - zoom) / 2, w * zoom, h * zoom);
    };
    if (type === 'blur') ctx.filter = `blur(${Math.sin(Math.PI * p) * 20}px)`;
    draw(left, 1 - p, type === 'zoomIn' ? 1 + p * .2 : type === 'zoomOut' ? 1 - p * .2 : 1);
    draw(right, p, type === 'zoomIn' ? .8 + p * .2 : type === 'zoomOut' ? 1.2 - p * .2 : 1);
    if (type === 'flash') { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.sin(Math.PI * p) ** 4; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, w, h); }
  }
  ctx.restore();
}
