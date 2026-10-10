import { it, expect } from 'vitest';
import { createProject } from '../src/shared/project';
import { makeMediaClip, makeTrack, validateTimeline } from '../src/renderer/engine/timeline';
import { applyReframe, reframeSource } from '../src/renderer/engine/reframe';
import { useEditor } from '../src/renderer/state/editor';

it('centers a tracked subject for portrait output, clamps edges, preserves timing and undoes atomically', () => {
  const p = createProject('p', 'Reframe', { width: 1080, height: 1920, fps: 30, sampleRate: 48000 });
  p.media.v = { id: 'v', path: 'video.mp4', kind: 'video', width: 1920, height: 1080, duration: 3e6, hasAudio: true, status: 'ready' };
  const track = makeTrack('t', 'video', 'Video'), clip = makeMediaClip('c', p.media.v, track.id, 1e6);
  clip.sourceIn = 1e6; clip.duration = 1e6; clip.speed = 2; clip.reverse = true; clip.transform.rotation.value = 10;
  track.clips.push(clip); p.tracks.push(track);
  useEditor.getState().load(p);
  useEditor.getState().edit(project => applyReframe(project, 'c', [{ time: 1e6, x: .1, y: .2 }, { time: 1.5e6, x: .5, y: .5 }, { time: 2e6 - 1, x: .9, y: .8 }]));
  expect(useEditor.getState().error).toBeNull();
  const after = useEditor.getState().project!, changed = after.tracks[0].clips[0]; validateTimeline(after);
  const ratio = (1920 / 1080) / (1080 / 1920);
  expect(changed.transform.x.keyframes.map(k => k.value)).toEqual([ratio / 2, .5, 1 - ratio / 2]);
  expect(changed.transform.y.keyframes.every(k => k.value === .5)).toBe(true);
  expect(changed).toMatchObject({ start: 1e6, sourceIn: 1e6, duration: 1e6, speed: 2, reverse: true });
  useEditor.getState().undo(); expect(useEditor.getState().project).toEqual(p);
  const input = reframeSource(p, clip); expect(input.project.settings.width).toBe(1920); expect(input.clip.transform.rotation.value).toBe(0); expect(clip.transform.rotation.value).toBe(10);
});

it('rejects partial tracking and locked clips without modifying them', () => {
  const p = createProject('p', 'Reframe', { width: 1080, height: 1920, fps: 30, sampleRate: 48000 });
  p.media.v = { id: 'v', path: 'video.mp4', kind: 'video', width: 1920, height: 1080, duration: 2e6, hasAudio: false, status: 'ready' };
  const track = makeTrack('t', 'video', 'Video'); track.clips.push(makeMediaClip('c', p.media.v, track.id, 0)); p.tracks.push(track);
  expect(() => applyReframe(p, 'c', [])).toThrow('complete'); track.locked = true;
  expect(() => applyReframe(p, 'c', [])).toThrow('locked');
});
