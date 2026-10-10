import { it, expect } from 'vitest';
import { createProject } from '../src/shared/project';
import { captionClip } from '../src/renderer/engine/captionImport';
import { commonValue, editTextStyles } from '../src/renderer/engine/bulkText';
import { useEditor } from '../src/renderer/state/editor';

function fixture() {
  const project = createProject('p', 'Bulk captions', { width: 640, height: 360, fps: 30, sampleRate: 48000 });
  const clips = ['one', 'two', 'three'].map((text, i) => captionClip({ text, start: i * 1e6, end: (i + 1) * 1e6, words: [{ text, start: i * 1e6, end: (i + 1) * 1e6 }] }, 'captions', text));
  clips[0].style.color = '#ff0000'; clips[1].style.color = '#00ff00';
  project.tracks = [{ id: 'captions', name: 'Captions', kind: 'text', locked: false, hidden: false, muted: false, clips }]; return project;
}
it('bulk style edits preserve distinct properties, captions and unselected clips with atomic undo', () => {
  const project = fixture(); useEditor.getState().load(project);
  useEditor.getState().edit(project => editTextStyles(project, ['one', 'two'], style => { style.fontSize = 72; style.stroke = { color: '#ffffff', width: 4 }; }));
  const changed = useEditor.getState().project!.tracks[0].clips;
  expect(useEditor.getState().error).toBeNull(); expect(useEditor.getState().history).toHaveLength(1);
  for (let i = 0; i < 2; i++) {
    expect(changed[i]).toMatchObject({ style: { fontSize: 72, color: i ? '#00ff00' : '#ff0000', stroke: { color: '#ffffff', width: 4 } } });
    expect(changed[i]).toMatchObject({ content: project.tracks[0].clips[i].type === 'text' ? ['one', 'two'][i] : '', start: i * 1e6, duration: 1e6, caption: { words: [{ text: ['one', 'two'][i], start: 0, end: 1e6 }] } });
  }
  expect(changed[2]).toEqual(project.tracks[0].clips[2]); useEditor.getState().undo(); expect(useEditor.getState().project).toEqual(project);
});
it('rejects a locked selection before changing any style and reports common/mixed values', () => {
  const project = fixture(), last = project.tracks[0].clips.pop()!; last.trackId = 'locked';
  project.tracks.push({ id: 'locked', name: 'Locked', kind: 'text', locked: true, hidden: false, muted: false, clips: [last] });
  const before = structuredClone(project);
  expect(() => editTextStyles(project, ['one', 'three'], style => { style.fontSize = 100; })).toThrow('locked'); expect(project).toEqual(before);
  expect(commonValue([0, 0])).toBe(0); expect(commonValue([false, false])).toBe(false); expect(commonValue(['red', 'blue'])).toBeUndefined();
});
