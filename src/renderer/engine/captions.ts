import type { Project, TextClip } from '../../shared/types';
export function srtTime(time: number): string {
  const ms = Math.max(0, Math.round(time / 1000));
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
}
export function exportSrt(project: Project): string {
  const captions = project.tracks.filter(track => !track.hidden).flatMap(track => track.clips.filter((clip): clip is TextClip => clip.type === 'text' && Boolean(clip.caption))).sort((a, b) => a.start - b.start);
  return captions.map((clip, i) => `${i + 1}\n${srtTime(clip.start)} --> ${srtTime(clip.start + clip.duration)}\n${clip.content.trim()}\n`).join('\n');
}
