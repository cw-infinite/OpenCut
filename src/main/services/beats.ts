import { spawn } from 'node:child_process';
import type { ProjectStore } from './projectStore';
import { ffmpegPath } from './tools';
import { atempoChain } from '../../renderer/engine/ffmpegArgs';
import { detectOnsets } from '../../renderer/engine/beats';

export async function analyzeBeats(store: ProjectStore, projectId: string, clipId: string): Promise<number[]> {
  const { project } = await store.readStable(projectId);
  const clip = project.tracks.flatMap(track => track.clips).find(clip => clip.id === clipId);
  if (clip?.type !== 'media' || !project.media[clip.mediaId]?.hasAudio) throw new Error('Select a clip with audio');
  const energy: number[] = [];
  await new Promise<void>((resolve, reject) => {
    const filters = [...(clip.reverse ? ['areverse'] : []), ...atempoChain(clip.speed)];
    const child = spawn(ffmpegPath, ['-v', 'error', '-nostdin', '-ss', String(clip.sourceIn / 1e6), '-t', String((clip.sourceOut - clip.sourceIn) / 1e6), '-i', project.media[clip.mediaId].path,
      '-vn', '-af', filters.join(','), '-ac', '1', '-ar', '8000', '-f', 'f32le', 'pipe:1'], { windowsHide: true });
    let carry: Buffer = Buffer.alloc(0), sum = 0, count = 0, tail = '';
    child.stdout.on('data', (chunk: Buffer) => {
      const data = carry.length ? Buffer.concat([carry, chunk]) : chunk, end = data.length - data.length % 4;
      for (let i = 0; i < end; i += 4) { const sample = data.readFloatLE(i); sum += sample * sample; if (++count === 80) { energy.push(sum / count); sum = 0; count = 0; } }
      carry = data.subarray(end);
    });
    child.stderr.on('data', chunk => { tail = (tail + chunk).slice(-4000); });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(tail || 'Beat analysis failed')));
  });
  return detectOnsets(energy).filter(time => time < clip.duration).map(time => time + clip.start);
}
