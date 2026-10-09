import { it, expect } from 'vitest';
import { createProject } from '../src/shared/project';
import { makeTextClip } from '../src/renderer/engine/text';
import { makeTrack } from '../src/renderer/engine/timeline';
import { moveSelection } from '../src/renderer/engine/selection';
import { useEditor } from '../src/renderer/state/editor';

function fixture() {
  const project = createProject('selection', 'Selection', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
  for (let i = 0; i < 3; i++) { const track = makeTrack('t' + i, 'text', 'Text'); const clip = makeTextClip('c' + i, track.id, i * 1e6); clip.duration = 1e6; track.clips = [clip]; project.tracks.push(track); }
  return project;
}
it('moves a selection with one delta, clamps against zero and rolls back collisions/locked tracks', () => {
  const project = fixture(); useEditor.getState().load(project); useEditor.getState().select(['c0', 'c1']);
  useEditor.getState().edit(project => moveSelection(project, ['c0', 'c1'], 2e6));
  expect(useEditor.getState().project!.tracks.map(track => track.clips[0].start)).toEqual([2e6, 3e6, 2e6]);
  expect(useEditor.getState().history).toHaveLength(1); useEditor.getState().undo();
  useEditor.getState().edit(project => moveSelection(project, ['c0', 'c1'], -2e6));
  expect(useEditor.getState().project!.tracks.map(track => track.clips[0].start)).toEqual([0, 1e6, 2e6]);
  const before = useEditor.getState().project;
  useEditor.getState().edit(project => moveSelection(project, ['c0', 'c1'], 1e6, 1));
  expect(useEditor.getState().error).toContain('overlap'); expect(useEditor.getState().project).toBe(before);
  useEditor.getState().edit(project => { project.tracks[1].locked = true; });
  const locked = useEditor.getState().project; useEditor.getState().edit(project => moveSelection(project, ['c0', 'c1'], 1e6)); expect(useEditor.getState().project).toBe(locked);
});
it('duplicates the whole selection after its span, remaps links, and deletes only explicitly selected clips', () => {
  const project = fixture(); project.tracks[0].clips[0].linkId = project.tracks[1].clips[0].linkId = 'group';
  useEditor.getState().load(project); useEditor.getState().select(['c0', 'c1']); useEditor.getState().duplicate();
  const result = useEditor.getState(); expect(result.selected).toHaveLength(2);
  expect(result.project!.tracks[0].clips.map(clip => clip.start)).toEqual([0, 2e6]); expect(result.project!.tracks[1].clips.map(clip => clip.start)).toEqual([1e6, 3e6]);
  const a = result.project!.tracks[0].clips[1], b = result.project!.tracks[1].clips[1]; expect(a.linkId).toBe(b.linkId); expect(a.linkId).not.toBe('group');
  result.undo(); useEditor.getState().select(['c0']); useEditor.getState().remove();
  expect(useEditor.getState().project!.tracks[0].clips).toHaveLength(0); expect(useEditor.getState().project!.tracks[1].clips).toHaveLength(1);
});
