import { describe, expect, it } from 'vitest';
import { captionClip, chunkWords, parseSrt, whisperWords } from '../src/renderer/engine/captionImport';
import { shiftAnimation } from '../src/renderer/engine/keyframes';
import { exportSrt } from '../src/renderer/engine/captions';
import { createProject } from '../src/shared/project';
import { makeTrack, validateTimeline } from '../src/renderer/engine/timeline';
import { captionWordState, styleCaption } from '../src/renderer/engine/captionStyle';
import { mergeCaption, splitCaption } from '../src/renderer/engine/captionEdits';
import { refineSpeechTiming, silenceCollector } from '../src/renderer/engine/speechTiming';

describe('caption timing and interchange', () => {
  it('reads millisecond Whisper offsets, drops empty segments, and applies the edit offset', () => {
    expect(whisperWords({ transcription: [{ text: '', offsets: { from: 0, to: 100 } }, { text: ' Hello world.', offsets: { from: 100, to: 1100 } }] }, 2e6, 800000)).toEqual([
      { text: 'Hello', start: 2100000, end: 2600000 }, { text: 'world.', start: 2600000, end: 2800000 }
    ]);
  });
  it('uses DTW centers without punctuation and tightens only quiet-gap boundaries', () => {
    const words = whisperWords({ transcription: [
      { text: ' Hello.', offsets: { from: 0, to: 1800 }, tokens: [{ text: ' Hello', t_dtw: 40 }, { text: '.', t_dtw: 150 }] },
      { text: ' Again', offsets: { from: 1800, to: 2500 }, tokens: [{ text: ' Again', t_dtw: 220 }] }
    ] });
    expect(words[0].end).toBe(1300000); expect(words[1].start).toBe(1300000);
    const collector = silenceCollector(); collector.push('silence_sta'); collector.push('rt: 0.8\nsilence_end: 2.0 | silence_duration: 1.2\n');
    expect(collector.gaps).toEqual([{ start: 800000, end: 2e6 }]);
    expect(refineSpeechTiming(words, collector.gaps)).toEqual([{ text: 'Hello.', start: 0, end: 800000 }, { text: 'Again', start: 2e6, end: 2500000 }]);
  });
  it('chunks at punctuation/word limits and fills only short gaps without overlap', () => {
    const words = ['Welcome', 'to', 'OpenCut.', 'Make', 'a', 'story', 'today.'].map((text, i) => ({ text, start: i * 300000, end: i * 300000 + 250000 }));
    const cues = chunkWords(words, 16, 3);
    expect(cues.map(cue => cue.text)).toEqual(['Welcome to\nOpenCut.', 'Make a story', 'today.']);
    expect(cues[0].end).toBe(cues[1].start);
    expect(cues.every(cue => cue.text.split('\n').length <= 2)).toBe(true);
    const clip = captionClip(cues[1], 't', 'c'); shiftAnimation(clip, 100000);
    expect(clip.caption!.words[0].start).toBe(-100000);
    expect(() => chunkWords(words, 0)).toThrow();
  });
  it('round trips SRT as caption clips and rejects invalid/overlapping cues', () => {
    const cues = parseSrt('\uFEFF1\r\n00:00:02,000 --> 00:00:03,450\r\nHello\r\nworld\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,000\r\nAgain\r\n');
    const project = createProject('p', 'Captions', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
    const track = makeTrack('t', 'text', 'Captions'); track.clips = cues.map((cue, i) => captionClip(cue, 't', 'c' + i)); project.tracks.push(track);
    validateTimeline(project); expect(parseSrt(exportSrt(project))).toEqual(cues);
    expect(() => parseSrt('1\n00:00:00,000 --> 00:00:02,000\nx\n\n2\n00:00:01,000 --> 00:00:03,000\ny')).toThrow(/Overlapping/);
    expect(() => parseSrt('1\n00:00:02,000 --> 00:00:01,000\nx')).toThrow();
  });
  it('preserves word timing through caption split/merge and honors line limits', () => {
    const words = ['one', 'two', 'three', 'four'].map((text, i) => ({ text, start: i * 1e6, end: (i + 1) * 1e6 }));
    expect(chunkWords(words, 8, 6, 1).every(cue => !cue.text.includes('\n'))).toBe(true);
    const project = createProject('p', 'Captions', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
    const track = makeTrack('t', 'text', 'Captions'), clip = captionClip({ text: 'one two three four', start: 0, end: 4e6, words }, 't', 'c');
    track.clips = [clip]; project.tracks.push(track); styleCaption(clip, 'Karaoke', .85);
    splitCaption(project, 'c', 'right'); validateTimeline(project);
    expect(track.clips[1].type === 'text' && track.clips[1].caption?.words[0]).toEqual({ text: 'three', start: 0, end: 1e6 });
    mergeCaption(project, 'c'); validateTimeline(project); expect(clip.caption?.words).toEqual(words); expect(clip.caption?.preset).toBe('karaoke');
    expect(captionWordState(clip, 0, 500000)).toMatchObject({ active: true, scale: 1.12 });
    expect(captionWordState(clip, 0, 1e6).active).toBe(false);
    styleCaption(clip, 'Word pop', .85); expect(captionWordState(clip, 1, 500000).visible).toBe(false);
    expect(captionWordState(clip, 1, 1200000)).toMatchObject({ visible: true, scale: 1 });
  });
});
