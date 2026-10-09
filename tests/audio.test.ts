import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createProject } from '../src/shared/project';
import { makeMediaClip, makeTrack } from '../src/renderer/engine/timeline';
import { audible, duckEnvelope } from '../src/renderer/engine/audio';
import { evaluate } from '../src/renderer/engine/keyframes';
import { detectOnsets } from '../src/renderer/engine/beats';
import { audioExportArgs, audioMixArgs } from '../src/renderer/engine/ffmpegArgs';
import { ffmpegPath, ffprobePath } from '../src/main/services/tools';
import { runProcess } from '../src/main/services/process';

function fixture(path: string) {
  const project = createProject('p', 'Audio', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
  project.media.m = { id: 'm', path, kind: 'audio', duration: 4e6, hasAudio: true, status: 'ready' };
  const music = makeTrack('music', 'audio', 'Music'), speech = makeTrack('speech', 'audio', 'Speech');
  music.clips.push(makeMediaClip('m', project.media.m, music.id, 0));
  const voice = makeMediaClip('v', project.media.m, speech.id, 1e6); voice.duration = 1e6; voice.sourceOut = 1e6; voice.volume.value = 0;
  speech.clips.push(voice); music.ducking = { speechTrackIds: ['speech'], gain: .25, attack: 200000, release: 500000 };
  project.tracks.push(music, speech); return { project, music, speech };
}
describe('advanced audio', () => {
  it('ducks around speech with attack/release and honors mute/solo', () => {
    const { project, music, speech } = fixture('music.wav'), envelope = duckEnvelope(project, music);
    expect([0, 800000, 900000, 1e6, 2e6, 2250000, 2500000, 3e6].map(time => evaluate(envelope, time))).toEqual([1, 1, .625, .25, .25, .625, 1, 1]);
    speech.muted = true; expect(duckEnvelope(project, music).keyframes).toEqual([]);
    speech.muted = false; speech.solo = true; expect(audible(project, music)).toBe(false); expect(audible(project, speech)).toBe(true);
  });
  it('detects separated transient onsets without duplicate markers', () => {
    const energy = Array.from({ length: 250 }, () => .000001);
    for (const index of [50, 100, 150, 200]) { energy[index] = .8; energy[index + 1] = .4; energy[index + 2] = .1; }
    expect(detectOnsets(energy)).toEqual([500000, 1000000, 1500000, 2000000]);
    expect(detectOnsets(Array(200).fill(.2))).toEqual([]);
  });
  it('writes real WAV/MP3/AAC audio and measures the ducked gain and master volume', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'opencut-audio-'));
    try {
      const source = join(folder, 'tone.wav');
      await runProcess(ffmpegPath, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4:sample_rate=48000', source]);
      const { project } = fixture(source); project.masterVolume = .5;
      const mix = join(folder, 'mix.wav'), raw = join(folder, 'mix.pcm');
      await runProcess(ffmpegPath, ['-v', 'error', '-y', ...audioMixArgs(project, { start: 0, end: 4e6, fps: 30, totalFrames: 120 }, mix)]);
      await runProcess(ffmpegPath, ['-v', 'error', '-y', '-i', mix, '-ac', '1', '-f', 's16le', raw]);
      const bytes = await readFile(raw);
      const rms = (second: number) => { let sum = 0; for (let i = second * 48000; i < (second + .2) * 48000; i++) sum += bytes.readInt16LE(Math.floor(i) * 2) ** 2; return Math.sqrt(sum / 9600); };
      expect(rms(1.4) / rms(.4)).toBeCloseTo(.25, 2); expect(rms(3) / rms(.4)).toBeCloseTo(1, 2);
      expect(rms(.4)).toBeLessThan(1600);
      for (const format of ['wav', 'mp3', 'aac'] as const) {
        const output = join(folder, 'result.' + format); await runProcess(ffmpegPath, audioExportArgs(format, 192, mix, output));
        const result = JSON.parse(await runProcess(ffprobePath, ['-v', 'error', '-show_streams', '-of', 'json', output]));
        expect(result.streams).toHaveLength(1); expect(result.streams[0].codec_type).toBe('audio');
        expect(result.streams[0].codec_name).toBe(format === 'wav' ? 'pcm_s16le' : format);
      }
    } finally { await rm(folder, { recursive: true, force: true }); }
  }, 30000);
});
