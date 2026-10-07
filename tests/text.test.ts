import { describe, expect, it } from 'vitest';
import { animationAt, loopPresets, textMotion, textPresets } from '../src/renderer/engine/textAnimations';
import { makeTextClip } from '../src/renderer/engine/text';
import { validateText } from '../src/renderer/engine/textValidation';
import type { TextAnimation } from '../src/shared/types';

describe('text animation boundaries', () => {
  it('finishes every in animation at identity and starts invisible or unrevealed', () => {
    for (const preset of textPresets) {
      const start = textMotion(preset, 0), end = textMotion(preset, 1);
      expect(start.opacity === 0 || start.reveal === 0).toBe(true);
      expect(end.dx).toBeCloseTo(0); expect(end.dy).toBeCloseTo(0); expect(end.scale).toBeCloseTo(1);
      expect(end.opacity).toBe(1); expect(end.reveal).toBe(1); expect(end.rotation).toBeCloseTo(0); expect(end.blur).toBe(0);
    }
  });
  it('mirrors out timing and staggers characters without negative progress', () => {
    const animation: TextAnimation = { preset: 'typewriter', duration: 500000, easing: 'linear', granularity: 'char', stagger: 100000 };
    expect(animationAt(animation, 50000, 2e6, 1, 5, 'in').reveal).toBe(0);
    expect(animationAt(animation, 600000, 2e6, 1, 5, 'in').reveal).toBe(1);
    expect(animationAt(animation, 0, 2e6, 0, 5, 'out').reveal).toBe(1);
    expect(animationAt(animation, 2e6, 2e6, 4, 5, 'out').reveal).toBe(0);
    for (const preset of loopPresets) for (const progress of [0, .25, .5, .75, 1]) expect(Object.values(textMotion(preset, progress, true)).every(Number.isFinite)).toBe(true);
  });
  it('validates text style and animation data before rendering', () => {
    const clip = makeTextClip('text', 'track', 0); expect(() => validateText(clip)).not.toThrow();
    clip.style.fontSize = NaN; expect(() => validateText(clip)).toThrow(); clip.style.fontSize = 80;
    clip.animIn = { preset: 'pop', duration: 0, easing: 'linear', granularity: 'whole', stagger: 0 };
    expect(() => validateText(clip)).toThrow('timing');
  });
});
