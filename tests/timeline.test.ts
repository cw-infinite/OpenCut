import { describe, expect, it } from 'vitest';
import { createProject } from '../src/shared/project';
import { makeMediaClip, makeTrack, validateTimeline, splitClip, trimClip, moveClip, deleteClips, snapTime } from '../src/renderer/engine/timeline';
import { frameTime, toFrame, toUs } from '../src/renderer/engine/time';
import { useEditor } from '../src/renderer/state/editor';
import type { MediaClip } from '../src/shared/types';

function fixture() {
  const project = createProject('project', 'Edit', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
  project.media.video = { id: 'video', path: 'C:/video.mp4', kind: 'video', duration: 10_000_000, hasAudio: true, status: 'ready' };
  const track = makeTrack('track', 'video', 'Video');
  track.clips.push(makeMediaClip('clip', project.media.video, 'track', 0)); project.tracks.push(track);
  return project;
}
describe('integer-time timeline', () => {
  it('round-trips one hour of frame times without accumulated drift', () => {
    for (const fps of [24, 25, 30, 50, 60]) for (const n of [1, 100, 10000, fps * 3600]) expect(toFrame(frameTime(n, fps), fps)).toBe(n);
    expect(toUs(.1234567)).toBe(123457);
  });
  it('split and trim preserve source boundaries and duration invariants', () => {
    const project = fixture(); splitClip(project, 'clip', 4_000_000, 'right');
    trimClip(project, 'right', 'start', 5_000_000); validateTimeline(project);
    const clips = project.tracks[0].clips as MediaClip[];
    expect(clips.map(clip => [clip.start, clip.duration, clip.sourceIn, clip.sourceOut])).toEqual([[0, 4e6, 0, 4e6], [5e6, 5e6, 5e6, 10e6]]);
  });
  it('rejects overlap, invalid trims and locked movement', () => {
    const project = fixture(); splitClip(project, 'clip', 4e6, 'right');
    moveClip(project, 'right', 'track', 3e6); expect(() => validateTimeline(project)).toThrow('overlap');
    const fresh = fixture(); trimClip(fresh, 'clip', 'end', 11e6); expect(() => validateTimeline(fresh)).toThrow('source');
    fresh.tracks[0].locked = true; expect(() => moveClip(fresh, 'clip', 'track', 2e6)).toThrow('locked');
  });
  it('ripple deletion closes the removed interval and snapping uses nearest edges', () => {
    const project = fixture(); splitClip(project, 'clip', 4e6, 'right'); deleteClips(project, ['clip'], true);
    expect(project.tracks[0].clips[0].start).toBe(0); validateTimeline(project);
    expect(snapTime(1003, [900, 1000, 1100], 10)).toBe(1000);
    expect(snapTime(1030, [900, 1000, 1100], 10)).toBe(1030);
  });
  it('keeps more than 100 reversible edits and rejects invalid edits without changing state', () => {
    useEditor.getState().load(fixture());
    for (let i = 0; i < 120; i++) useEditor.getState().edit(project => { project.name = String(i); });
    expect(useEditor.getState().history).toHaveLength(120);
    for (let i = 0; i < 120; i++) useEditor.getState().undo();
    expect(useEditor.getState().project?.name).toBe('Edit');
    for (let i = 0; i < 120; i++) useEditor.getState().redo();
    expect(useEditor.getState().project?.name).toBe('119');
    const before = useEditor.getState().project;
    useEditor.getState().edit(project => trimClip(project, 'clip', 'end', 20e6));
    expect(useEditor.getState().project).toBe(before);
  });
});
