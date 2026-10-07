import { describe, expect, it } from 'vitest';
import { createProject } from '../src/shared/project';
import { makeMediaClip, makeTrack, validateTimeline } from '../src/renderer/engine/timeline';
import { applyDefaultTransitions, applyTransition } from '../src/renderer/engine/transitions';
import { changeSpeed } from '../src/renderer/engine/speed';

function fixture() {
  const project = createProject('p', 'Cuts', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
  project.media.m = { id: 'm', path: 'source.mp4', kind: 'video', duration: 2e6, hasAudio: true, status: 'ready' };
  const track = makeTrack('v', 'video', 'Video');
  for (let i = 0; i < 3; i++) track.clips.push(makeMediaClip(String(i), project.media.m, 'v', i * 2e6));
  project.tracks.push(track); return project;
}
describe('transition overlaps', () => {
  it('ripples subsequent cuts when applying, resizing and removing transitions', () => {
    const project = fixture(), clips = project.tracks[0].clips;
    applyTransition(project, '1', 'dissolve', 500000); validateTimeline(project);
    expect(clips.map(clip => clip.start)).toEqual([0, 1.5e6, 3.5e6]);
    applyTransition(project, '1', 'wipeLeft', 1e6); validateTimeline(project);
    expect(clips.map(clip => clip.start)).toEqual([0, 1e6, 3e6]);
    applyTransition(project, '1', 'none', 0); validateTimeline(project);
    expect(clips.map(clip => clip.start)).toEqual([0, 2e6, 4e6]);
  });
  it('rejects gaps, triple overlaps and orphaned transitions', () => {
    const project = fixture(); applyTransition(project, '1', 'dissolve', 1.5e6);
    expect(() => applyTransition(project, '2', 'dissolve', 1e6)).toThrow('too long');
    project.tracks[0].clips[1].start += 1;
    expect(() => validateTimeline(project)).toThrow('exact overlap');
    const gap = fixture(); gap.tracks[0].clips[1].start += 100;
    expect(() => applyTransition(gap, '1', 'dissolve', 100)).toThrow('gap');
  });
  it('applies defaults and keeps transitions aligned through a speed change', () => {
    const project = fixture(); applyDefaultTransitions(project); validateTimeline(project);
    expect(project.tracks[0].clips.map(clip => clip.start)).toEqual([0, 1.5e6, 3e6]);
    changeSpeed(project, '0', .5); validateTimeline(project);
    expect(project.tracks[0].clips.map(clip => clip.start)).toEqual([0, 3.5e6, 5e6]);
  });
});
