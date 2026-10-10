import { it, expect } from 'vitest';
import { templateTracker, applyTracking } from '../src/renderer/engine/tracking';
import { createProject } from '../src/shared/project';
import { makeTrack, makeMediaClip } from '../src/renderer/engine/timeline';
import { makeTextClip } from '../src/renderer/engine/text';
import { useEditor } from '../src/renderer/state/editor';

it('tracks a textured patch in both directions and rejects lost or flat subjects', () => {
  const frame = (x: number) => {
    const data = new Uint8ClampedArray(80 * 60 * 4);
    for (let y = 20; y <= 36; y++) for (let dx = -8; dx <= 8; dx++) for (let c = 0; c < 3; c++) data[(y * 80 + x + dx) * 4 + c] = (dx + y) % 2 ? 220 : 100;
    return { width: 80, height: 60, data };
  };
  const tracker = templateTracker(frame(30), 30, 28);
  expect(tracker(frame(35))).toEqual({ x: 35, y: 28 });
  expect(tracker(frame(25))).toEqual({ x: 25, y: 28 });
  expect(() => tracker({ ...frame(25), data: new Uint8ClampedArray(80 * 60 * 4) })).toThrow('Subject lost');
  expect(() => templateTracker(frame(30), 9, 9)).toThrow('detailed');
  expect(() => templateTracker(frame(30), 0, 0)).toThrow('edge');
});

it('applies offset-preserving tracking as one undoable edit and protects locked targets', () => {
  const project = createProject('p', 'Tracking', { width: 640, height: 480, fps: 30, sampleRate: 48000 });
  project.media.v = { id: 'v', path: 'v.mp4', kind: 'video', duration: 2e6, status: 'ready', hasAudio: false };
  const video = makeTrack('v', 'video', 'Video'), text = makeTrack('t', 'text', 'Text');
  video.clips = [makeMediaClip('video-clip', project.media.v, 'v', 0)];
  text.clips = [makeTextClip('text-clip', 't', 0)];
  project.tracks = [video, text];
  const points = [{ time: 0, x: .25, y: .5 }, { time: 2e6 - 1, x: .75, y: .6 }];
  useEditor.getState().load(project); const originalX = text.clips[0].transform.x.value;
  useEditor.getState().edit(project => applyTracking(project, 'video-clip', 'text-clip', points));
  expect(useEditor.getState().error).toBeNull();
  expect(useEditor.getState().project!.tracks[1].clips[0].transform.x.keyframes.map(key => key.value)).toEqual([originalX, originalX + .5, originalX]);
  useEditor.getState().undo(); expect(useEditor.getState().project).toEqual(project);
  const locked = structuredClone(project); locked.tracks[1].locked = true; useEditor.getState().load(locked);
  useEditor.getState().edit(project => applyTracking(project, 'video-clip', 'text-clip', points));
  expect(useEditor.getState().error).toContain('locked'); expect(useEditor.getState().project).toBe(locked);
});
