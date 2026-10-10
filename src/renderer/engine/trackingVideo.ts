import type { MediaClip, Project } from '../../shared/types';
import { renderFrame, sourceTime } from './compositor';

export async function trackingVideo(project: Project, clip: MediaClip, url: string, signal: AbortSignal) {
  const video = document.createElement('video'); video.crossOrigin = 'anonymous'; video.muted = true; video.preload = 'auto';
  const dispose = () => { video.pause(); video.removeAttribute('src'); video.load(); };
  const wait = (event: string, action: () => void) => new Promise<void>((resolve, reject) => {
    const done = () => { cleanup(); resolve(); }, failed = () => { cleanup(); reject(new Error(signal.aborted ? 'Tracking canceled.' : 'Could not decode tracking video.')); };
    const timer = window.setTimeout(failed, 15000);
    const cleanup = () => { clearTimeout(timer); video.removeEventListener(event, done); video.removeEventListener('error', failed); signal.removeEventListener('abort', failed); };
    video.addEventListener(event, done, { once: true }); video.addEventListener('error', failed, { once: true }); signal.addEventListener('abort', failed, { once: true });
    if (signal.aborted) failed(); else action();
  });
  try { await wait('loadeddata', () => { video.src = url; video.load(); }); } catch (error) { dispose(); throw error; }
  const canvas = document.createElement('canvas');
  const scale = 320 / Math.max(project.settings.width, project.settings.height);
  canvas.width = Math.max(1, Math.round(project.settings.width * scale)); canvas.height = Math.max(1, Math.round(project.settings.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const isolated = { ...project, tracks: project.tracks.map(track => ({ ...track, hidden: false, clips: track.clips.filter(item => item.id === clip.id) })) };
  return { dispose, async frame(time: number) {
    if (signal.aborted) throw new Error('Tracking canceled.');
    const seconds = sourceTime(clip, time) / 1e6;
    if (Math.abs(video.currentTime - seconds) > .000001) await wait('seeked', () => { video.currentTime = seconds; });
    renderFrame(ctx, isolated, time, { source: () => video });
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } };
}
