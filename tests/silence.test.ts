import { it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStore } from '../src/main/services/projectStore';
import { analyzeSilence } from '../src/main/services/silence';
import { probe } from '../src/main/services/mediaProbe';
import { ffmpegPath } from '../src/main/services/tools';
import { runProcess } from '../src/main/services/process';
import { makeMediaClip, makeTrack, durationOf } from '../src/renderer/engine/timeline';
import { cutTimelineRange } from '../src/renderer/engine/rangeCut';
import { useEditor } from '../src/renderer/state/editor';

it('detects silence on trimmed/reversed/speed-adjusted audio and removes it with one undo', async () => {
  const root = await mkdtemp(join(tmpdir(), 'opencut-silence-'));
  try {
    const path = join(root, 'quiet.wav');
    await runProcess(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', '-af', "volume=0:enable='between(t,1,2)'", path]);
    const store = new ProjectStore(root), project = await store.create('Silence', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
    const asset = await probe(path, 'audio'), track = makeTrack('audio', 'audio', 'Audio');
    asset.status = 'ready';
    const clip = makeMediaClip('clip', asset, track.id, 0); track.clips = [clip];
    await store.update(project.id, project => { project.media.audio = asset; project.tracks = [track]; });
    const gaps = await analyzeSilence(store, project.id, clip.id, -40, .3);
    expect(gaps).toHaveLength(1); expect(gaps[0].start / 1e6).toBeCloseTo(1, 1); expect(gaps[0].end / 1e6).toBeCloseTo(2, 1);
    useEditor.getState().load((await store.read(project.id)).project);
    useEditor.getState().edit(project => cutTimelineRange(project, gaps[0].start + 50000, gaps[0].end - 50000, () => crypto.randomUUID()));
    expect(useEditor.getState().error).toBeNull(); expect(durationOf(useEditor.getState().project!)).toBeCloseTo(4e6 - gaps[0].end + gaps[0].start + 100000, 0);
    useEditor.getState().undo(); expect(durationOf(useEditor.getState().project!)).toBe(4e6);
    await store.update(project.id, project => { const clip = project.tracks[0].clips[0]; if (clip.type === 'media') { clip.sourceIn = 500000; clip.sourceOut = 3500000; clip.speed = 2; clip.reverse = true; clip.duration = 1500000; clip.start = 5e6; } });
    const reversed = await analyzeSilence(store, project.id, clip.id, -40, .2);
    expect(reversed).toHaveLength(1); expect(reversed[0].start / 1e6).toBeCloseTo(5.75, 1); expect(reversed[0].end / 1e6).toBeCloseTo(6.25, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
}, 30000);
