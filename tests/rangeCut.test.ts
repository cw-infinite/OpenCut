import { describe, expect, it } from 'vitest';
import { createProject } from '../src/shared/project';
import { makeMediaClip, makeTrack, validateTimeline } from '../src/renderer/engine/timeline';
import { captionClip } from '../src/renderer/engine/captionImport';
import { cutTimelineRange, fillerCandidates } from '../src/renderer/engine/rangeCut';
import { useEditor } from '../src/renderer/state/editor';

function fixture(reverse = false) {
  const project = createProject('p', 'Filler edit', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
  const asset = { id: 'video', path: 'C:/fixture.mp4', kind: 'video' as const, duration: 8e6, hasAudio: true, status: 'ready' as const };
  project.media[asset.id] = asset;
  for (const kind of ['video', 'audio'] as const) {
    const track = makeTrack(kind, kind, kind), clip = makeMediaClip(kind + '-clip', asset, track.id, 0);
    clip.speed = 2; clip.duration = 4e6; clip.reverse = reverse; clip.linkId = 'pair'; clip.transform.x.keyframes = [{ time: 0, value: .2, easing: 'linear' }, { time: 4e6, value: .8, easing: 'linear' }];
    track.clips.push(clip); project.tracks.push(track);
  }
  const track = makeTrack('captions', 'text', 'Captions');
  track.clips.push(captionClip({ start: 0, end: 4e6, text: 'Hello um, world.', words: [{ text: 'Hello', start: 0, end: 1e6 }, { text: 'um,', start: 1e6, end: 2e6 }, { text: 'world.', start: 2e6, end: 4e6 }] }, track.id, 'caption'));
  project.tracks.push(track); project.markers = [{ id: 'm', label: 'Later', time: 3e6 }]; return project;
}
describe('filler-word range cuts', () => {
  for (const reverse of [false, true]) it(`keeps linked source spans, caption words, keyframes and markers aligned (reverse=${reverse})`, () => {
    const project = fixture(reverse); let next = 0;
    expect(fillerCandidates(project)).toEqual([{ text: 'um,', start: 1e6, end: 2e6 }]);
    cutTimelineRange(project, 1e6, 2e6, () => `new-${++next}`); validateTimeline(project);
    const [left, right] = project.tracks[0].clips;
    expect(left.duration).toBe(1e6); expect(right.start).toBe(1e6); expect(right.duration).toBe(2e6);
    expect(right.linkId).toBe(project.tracks[1].clips[1].linkId); expect(right.linkId).not.toBe(left.linkId);
    if (left.type === 'media' && right.type === 'media') {
      expect([left.sourceIn, left.sourceOut, right.sourceIn, right.sourceOut]).toEqual(reverse ? [6e6, 8e6, 0, 4e6] : [0, 2e6, 4e6, 8e6]);
    }
    expect(right.transform.x.keyframes[0].time).toBe(-2e6);
    expect(project.tracks[2].clips.map(clip => clip.type === 'text' ? clip.content : '')).toEqual(['Hello', 'world.']);
    expect(fillerCandidates(project)).toEqual([]); expect(project.markers[0].time).toBe(2e6);
  });
  it('is a single undoable edit and refuses locked tracks without changing anything', () => {
    const project = fixture(); useEditor.getState().load(project); let next = 0;
    useEditor.getState().edit(draft => cutTimelineRange(draft, 1e6, 2e6, () => `new-${++next}`));
    expect(useEditor.getState().error).toBeNull(); expect(useEditor.getState().history).toHaveLength(1);
    useEditor.getState().undo(); expect(useEditor.getState().project).toEqual(project);
    useEditor.getState().redo(); expect(fillerCandidates(useEditor.getState().project!)).toHaveLength(0);
    const locked = fixture(); locked.tracks[1].locked = true; const before = JSON.stringify(locked);
    expect(() => cutTimelineRange(locked, 1e6, 2e6, () => 'new')).toThrow(/Unlock/); expect(JSON.stringify(locked)).toBe(before);
  });
});
