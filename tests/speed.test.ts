import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProject } from '../src/shared/project';
import { makeMediaClip, makeTrack, splitClip, trimClip, validateTimeline } from '../src/renderer/engine/timeline';
import { changeSpeed } from '../src/renderer/engine/speed';
import { audioMixArgs } from '../src/renderer/engine/ffmpegArgs';
import { ffmpegPath } from '../src/main/services/tools';
import { runProcess } from '../src/main/services/process';
import type { MediaClip } from '../src/shared/types';

function fixture(path = 'source.wav') {
  const project = createProject('p', 'Speed', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
  project.media.m = { id: 'm', path, kind: 'audio', duration: 2e6, hasAudio: true, status: 'ready' };
  const track = makeTrack('t', 'audio', 'Audio');
  track.clips.push(makeMediaClip('a', project.media.m, 't', 0), makeMediaClip('b', project.media.m, 't', 2e6));
  project.tracks.push(track); return project;
}
describe('speed and audio automation', () => {
  it('keeps integer source boundaries through fractional-speed changes, splits and trims', () => {
    for (const speed of [.1, .25, .5, 1.1, 1.23, 2, 99.99, 100]) {
      const project = fixture(); changeSpeed(project, 'a', speed); validateTimeline(project);
      const clip = project.tracks[0].clips[0];
      expect(project.tracks[0].clips[1].start).toBe(clip.duration);
      splitClip(project, 'a', clip.duration / 2, 'right');
      const right = project.tracks[0].clips.find(clip => clip.id === 'right')!;
      trimClip(project, 'right', 'start', right.start + 123); validateTimeline(project);
    }
  });
  it('ripples linked video/audio together and rejects excessive precision', () => {
    const project = fixture(), first = project.tracks[0].clips[0]; first.linkId = 'linked';
    const track = makeTrack('second', 'audio', 'Linked audio');
    const clone = structuredClone(first); clone.id = 'linked-a'; clone.trackId = track.id;
    track.clips.push(clone); project.tracks.push(track);
    changeSpeed(project, 'a', .5); validateTimeline(project);
    expect(first.duration).toBe(4e6); expect(clone.duration).toBe(4e6);
    expect(() => changeSpeed(project, 'a', .123)).toThrow('decimal');
  });
  it('renders pitch-preserved 0.5x/2x audio with correct duration and keyed gain', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'opencut-speed-'));
    try {
      const source = join(folder, 'tone.wav');
      await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2:sample_rate=48000', source]);
      for (const speed of [.5, 2]) {
        const project = fixture(source); project.tracks[0].clips.pop(); changeSpeed(project, 'a', speed);
        const clip = project.tracks[0].clips[0] as MediaClip;
        clip.volume.keyframes = [{ time: 0, value: 1, easing: { bezier: [.42, 0, .58, 1] } }, { time: clip.duration, value: .1, easing: 'linear' }];
        const output = join(folder, `mix-${speed}.wav`), raw = join(folder, `mix-${speed}.pcm`);
        await runProcess(ffmpegPath, ['-v', 'error', '-y', ...audioMixArgs(project, { start: 0, end: clip.duration, fps: 30, totalFrames: clip.duration * 30 / 1e6 }, output)]);
        await runProcess(ffmpegPath, ['-v', 'error', '-y', '-i', output, '-ac', '1', '-f', 's16le', raw]);
        const bytes = await readFile(raw), count = bytes.length / 2;
        expect(count / 48000).toBeCloseTo(clip.duration / 1e6, 3);
        const sample = (i: number) => bytes.readInt16LE(i * 2);
        const start = Math.floor(count * .2), end = Math.floor(count * .7);
        let crossings = 0;
        for (let i = start + 1; i < end; i++) if (sample(i - 1) <= 0 && sample(i) > 0) crossings++;
        expect(crossings * 48000 / (end - start)).toBeCloseTo(440, -1);
        const rms = (from: number, to: number) => { let sum = 0; for (let i = Math.floor(count * from); i < count * to; i++) sum += sample(i) ** 2; return Math.sqrt(sum / (count * (to - from))); };
        expect(rms(.1, .2)).toBeGreaterThan(rms(.7, .8) * 2);
      }
    } finally { await rm(folder, { recursive: true, force: true }); }
  }, 30000);
});
