import { describe, expect, it } from 'vitest';
import { ease, evaluate, setAnimatedValue } from '../src/renderer/engine/keyframes';
import { createProject } from '../src/shared/project';
import { makeMediaClip, makeTrack, splitClip, trimClip, validateTimeline } from '../src/renderer/engine/timeline';
import type { Animatable } from '../src/shared/types';

describe('keyframe animation', () => {
  it('evaluates boundaries, linear interpolation and hold jumps', () => {
    const value: Animatable<number> = { value: 3, keyframes: [] };
    expect(evaluate(value, 400)).toBe(3);
    value.keyframes = [{ time: 100, value: 0, easing: 'linear' }, { time: 200, value: 1, easing: 'hold' }, { time: 300, value: 2, easing: 'linear' }];
    expect([-10, 150, 250, 300, 900].map(time => evaluate(value, time))).toEqual([0, .5, 1, 2, 2]);
    setAnimatedValue(value, 150, .7); setAnimatedValue(value, 150, .8);
    expect(value.keyframes.map(key => key.time)).toEqual([100, 150, 200, 300]);
    expect(evaluate(value, 150)).toBe(.8);
  });
  it('solves Bezier time rather than treating progress as its parameter', () => {
    expect(ease(.5, { bezier: [.42, 0, .58, 1] })).toBeCloseTo(.5);
    expect(ease(.5, { bezier: [0, 0, 1, 1] })).toBeCloseTo(.5);
    expect(ease(.25, 'easeIn')).toBe(.0625);
    expect(ease(.25, 'easeOut')).toBe(.4375);
    expect(ease(.75, 'easeInOut')).toBe(.875);
  });
  it('preserves the exact curve through split and trim, including retained external keys', () => {
    const project = createProject('p', 'Animation', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
    project.media.m = { id: 'm', path: 'video.mp4', kind: 'video', duration: 10e6, hasAudio: true, status: 'ready' };
    const track = makeTrack('t', 'video', 'Video'), clip = makeMediaClip('c', project.media.m, 't', 0);
    clip.transform.x.keyframes = [{ time: 0, value: .1, easing: { bezier: [.42, 0, .58, 1] } }, { time: 10e6, value: .9, easing: 'linear' }];
    const original = structuredClone(clip.transform.x);
    track.clips.push(clip); project.tracks.push(track);
    splitClip(project, 'c', 4e6, 'right'); trimClip(project, 'right', 'start', 5e6); validateTimeline(project);
    const right = track.clips[1];
    for (const time of [5e6, 6e6, 8e6, 9.9e6]) expect(evaluate(right.transform.x, time - right.start)).toBeCloseTo(evaluate(original, time), 10);
    right.transform.x.keyframes[0].easing = { bezier: [2, 0, 0, 1] };
    expect(() => validateTimeline(project)).toThrow('Bezier');
  });
});
