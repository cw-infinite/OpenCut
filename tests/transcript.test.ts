import { it, expect } from 'vitest';
import { createProject } from '../src/shared/project';
import { captionClip } from '../src/renderer/engine/captionImport';
import { makeMediaClip, makeTrack, durationOf } from '../src/renderer/engine/timeline';
import { transcriptWords, transcriptRanges, deleteTranscriptWords } from '../src/renderer/engine/transcript';
import { useEditor } from '../src/renderer/state/editor';

function fixture() {
  const project = createProject('p', 'Transcript', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
  project.media.v = { id: 'v', path: 'video.mp4', kind: 'video', duration: 4e6, hasAudio: true, status: 'ready' };
  const video = makeTrack('v', 'video', 'Video'); video.clips = [makeMediaClip('video', project.media.v, video.id, 0)];
  const captions = makeTrack('t', 'text', 'Captions'); captions.clips = [captionClip({ text: 'Keep remove this ending', start: 0, end: 4e6, words: ['Keep', 'remove', 'this', 'ending'].map((text, i) => ({ text, start: i * 1e6, end: (i + 1) * 1e6 })) }, 't', 'caption')];
  project.tracks = [video, captions]; return project;
}
it('deletes selected transcript words from video and captions, preserving gaps and undo', () => {
  const project = fixture(), words = transcriptWords(project, 't'); useEditor.getState().load(project);
  useEditor.getState().edit(project => deleteTranscriptWords(project, 't', [words[1].id, words[3].id], () => crypto.randomUUID()));
  const edited = useEditor.getState().project!;
  expect(useEditor.getState().error).toBeNull(); expect(durationOf(edited)).toBe(2e6);
  expect(edited.tracks[0].clips).toMatchObject([{ start: 0, duration: 1e6, sourceIn: 0, sourceOut: 1e6 }, { start: 1e6, duration: 1e6, sourceIn: 2e6, sourceOut: 3e6 }]);
  expect(transcriptWords(edited, 't').map(word => word.text)).toEqual(['Keep', 'this']);
  expect(useEditor.getState().history).toHaveLength(1); useEditor.getState().undo(); expect(useEditor.getState().project).toEqual(project);
});
it('merges overlapping word ranges and rolls back cuts on locked tracks or stale words', () => {
  const words = [{ id: 'a', text: 'a', start: 0, end: 200 }, { id: 'b', text: 'b', start: 100, end: 300 }, { id: 'c', text: 'c', start: 500, end: 600 }];
  expect(transcriptRanges(words, ['a', 'b', 'c'])).toEqual([{ start: 0, end: 300 }, { start: 500, end: 600 }]);
  const project = fixture(); project.tracks[0].locked = true; useEditor.getState().load(project);
  useEditor.getState().edit(project => deleteTranscriptWords(project, 't', ['caption:1'], () => crypto.randomUUID()));
  expect(useEditor.getState().project).toBe(project); expect(useEditor.getState().error).toContain('Unlock');
  expect(() => deleteTranscriptWords(fixture(), 't', ['gone'], () => '')).toThrow('current transcript');
});
