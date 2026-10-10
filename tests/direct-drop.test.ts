import { it, expect } from 'vitest';
import { createProject } from '../src/shared/project';
import { useEditor } from '../src/renderer/state/editor';

it('creates correctly ordered tracks and places text/media at drop time in one undo entry', () => {
  const project = createProject('p', 'Drops', { width: 640, height: 360, fps: 30, sampleRate: 48000 });
  project.media.v = { id: 'v', kind: 'video', path: 'v.mp4', duration: 1e6, status: 'ready', hasAudio: false };
  useEditor.getState().load(project);
  useEditor.getState().addMedia('v', undefined, 2e6);
  useEditor.getState().addText(undefined, 3e6, 0);
  expect(useEditor.getState().project!.tracks.map(track => track.kind)).toEqual(['text', 'video']);
  expect(useEditor.getState().project!.tracks.map(track => track.clips[0].start)).toEqual([3e6, 2e6]);
  useEditor.getState().undo(); expect(useEditor.getState().project!.tracks).toHaveLength(1);
  useEditor.getState().undo(); expect(useEditor.getState().project).toEqual(project);
});

it('rejects overlapping or locked drops without replacing selection or adding history', () => {
  const project = createProject('p', 'Drops', { width: 640, height: 360, fps: 30, sampleRate: 48000 });
  useEditor.getState().load(project); useEditor.getState().addText(undefined, 0);
  const before = useEditor.getState(), track = before.project!.tracks[0];
  useEditor.getState().addText(track.id, 1e6);
  expect(useEditor.getState().project).toBe(before.project); expect(useEditor.getState().selected).toEqual(before.selected);
  expect(useEditor.getState().history).toHaveLength(1); expect(useEditor.getState().error).toContain('overlap');
  const locked = structuredClone(before.project!); locked.tracks[0].locked = true; useEditor.getState().load(locked);
  useEditor.getState().addText(track.id, 6e6);
  expect(useEditor.getState().project).toBe(locked); expect(useEditor.getState().history).toHaveLength(0); expect(useEditor.getState().error).toContain('locked');
});
