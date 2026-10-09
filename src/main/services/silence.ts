import { spawn } from 'node:child_process';
import type { ProjectStore } from './projectStore';
import { ffmpegPath } from './tools';
import { atempoChain } from '../../renderer/engine/ffmpegArgs';
import { silenceCollector } from '../../renderer/engine/speechTiming';

export async function analyzeSilence(store: ProjectStore, projectId: string, clipId: string, threshold: number, minimum: number, signal?: AbortSignal) {
  if (!Number.isFinite(threshold) || threshold < -80 || threshold > -10 || !Number.isFinite(minimum) || minimum < .1 || minimum > 5) throw new Error('Invalid silence settings');
  const { project } = await store.readStable(projectId), track = project.tracks.find(track => track.clips.some(clip => clip.id === clipId)), clip = track?.clips.find(clip => clip.id === clipId);
  if (track?.locked || clip?.type !== 'media' || !project.media[clip.mediaId]?.hasAudio) throw new Error('Select an unlocked clip with audio');
  const filters = [`atrim=start=${clip.sourceIn / 1e6}:end=${clip.sourceOut / 1e6}`, 'asetpts=PTS-STARTPTS', ...(clip.reverse ? ['areverse'] : []), ...atempoChain(clip.speed), `silencedetect=noise=${threshold}dB:d=${minimum}`];
  const collector = silenceCollector();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-nostdin', '-i', project.media[clip.mediaId].path, '-vn', '-af', filters.join(','), '-f', 'null', '-'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], signal });
    let tail = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Silence analysis timed out')); }, 600000);
    child.stderr.on('data', (chunk: Buffer) => { const text = chunk.toString(); collector.push(text); tail = (tail + text).slice(-2000); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); collector.push('\n'); if (code === 0) resolve(); else reject(new Error(tail)); });
  });
  return collector.gaps.map(gap => ({ start: clip.start + Math.max(0, gap.start), end: clip.start + Math.min(clip.duration, gap.end) })).filter(gap => gap.end > gap.start);
}
