import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createProject } from '../src/shared/project';
import { makeMediaClip, makeTrack } from '../src/renderer/engine/timeline';
import { audioMixArgs, atempoChain, makeExportPlan, qualityArgs, videoExportArgs } from '../src/renderer/engine/ffmpegArgs';
import { srtTime } from '../src/renderer/engine/captions';
import { runProcess } from '../src/main/services/process';
import { ffmpegPath, ffprobePath } from '../src/main/services/tools';
import type { ExportRequest } from '../src/shared/export';

const request: ExportRequest = { projectId: 'p', resolution: 720, fps: 30, quality: 'high', bitrateMbps: 12, audioBitrate: 192, encoderPreference: 'software' };
function fixture() {
  const project = createProject('p', 'Export', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
  project.media.audio = { id: 'audio', path: resolve('.test-data/fixtures/music.mp3'), kind: 'audio', duration: 2e6, hasAudio: true, status: 'ready' };
  const track = makeTrack('audio', 'audio', 'Audio'); track.clips.push(makeMediaClip('clip', project.media.audio, track.id, 0)); project.tracks.push(track);
  return project;
}
describe('export planning', () => {
  it('maps portrait/landscape sizes to even dimensions and rejects invalid ranges/settings', () => {
    const project = fixture(); expect(makeExportPlan(project, request)).toMatchObject({ width: 1280, height: 720, totalFrames: 60 });
    project.settings.width = 1080; project.settings.height = 1920;
    expect(makeExportPlan(project, { ...request, resolution: 1080 })).toMatchObject({ width: 1080, height: 1920 });
    expect(() => makeExportPlan(project, { ...request, range: { start: 2e6, end: 1e6 } })).toThrow();
    expect(() => makeExportPlan(project, { ...request, fps: 0 as 30 })).toThrow();
  });
  it('chains atempo beyond its per-filter limits', () => {
    expect(atempoChain(.1)).toEqual(['atempo=0.5', 'atempo=0.5', 'atempo=0.5', 'atempo=0.8']);
    expect(atempoChain(8)).toEqual(['atempo=2', 'atempo=2', 'atempo=2']);
    expect(atempoChain(100)).toEqual(['atempo=2', 'atempo=2', 'atempo=2', 'atempo=2', 'atempo=2', 'atempo=2', 'atempo=1.5625']);
    expect(() => atempoChain(0)).toThrow();
  });
  it('builds range-aware audio with fades, reverse, gain, sample-accurate delay and no normalization', () => {
    const project = fixture(), clip = project.tracks[0].clips[0];
    if (clip.type !== 'media') throw new Error();
    clip.start = 1e6; clip.speed = 2; clip.duration = 1e6; clip.reverse = true; clip.volume.value = .4; clip.fadeIn = 200000; clip.fadeOut = 300000;
    const plan = makeExportPlan(project, request), args = audioMixArgs(project, plan, 'mix.wav');
    expect(args[args.indexOf('-filter_complex') + 1]).toBe('[0:a:0]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS,areverse,atempo=2,volume=0.4,afade=t=in:st=0:d=0.200000,afade=t=out:st=0.700000:d=0.300000,atrim=start=0.000000:end=1.000000,asetpts=PTS-STARTPTS,adelay=48000S:all=1[a0];[a0]amix=inputs=1:normalize=0:duration=longest,alimiter=limit=0.95:level=false:latency=true,apad,atrim=duration=2.000000[mix]');
    project.tracks[0].muted = true; expect(audioMixArgs(project, plan, 'mix.wav')).toContain('anullsrc=r=48000:cl=stereo');
  });
  it('maps quality and raw RGBA/mux settings without shell interpolation', () => {
    expect(qualityArgs('libx264', 'maximum', 12)).toEqual(['-preset', 'medium', '-crf', '15']);
    expect(qualityArgs('h264_nvenc', 'high', 12)).toContain('-cq');
    expect(qualityArgs('libx264', 'custom', 8)).toContain('8M');
    const args = videoExportArgs(makeExportPlan(fixture(), request), 'libx264', 'C:/my mix.wav', 'C:/my edit.mp4');
    expect(args).toContain('rgba'); expect(args).toContain('yuv420p'); expect(args).toContain('+faststart'); expect(args.at(-1)).toBe('C:/my edit.mp4');
    expect(srtTime(3_661_123_000)).toBe('01:01:01,123');
  });
  it('renders silent audio for a video-only timeline with exactly the planned duration', async () => {
    const project = fixture(); project.tracks[0].muted = true;
    const folder = await mkdtemp(join(tmpdir(), 'opencut-export-test-'));
    try {
      const output = join(folder, 'mix.wav'), plan = makeExportPlan(project, request);
      await runProcess(ffmpegPath, ['-hide_banner', '-y', ...audioMixArgs(project, plan, output)]);
      const data = JSON.parse(await runProcess(ffprobePath, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', output]));
      expect(Number(data.format.duration)).toBeCloseTo(2, 4); expect(data.streams[0].sample_rate).toBe('48000');
    } finally { await rm(folder, { recursive: true, force: true }); }
  });
});
