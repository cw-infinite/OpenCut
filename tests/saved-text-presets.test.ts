import { expect, it } from 'vitest';
import { makeTextClip } from '../src/renderer/engine/text';
import { captureTextPreset, applyTextPreset } from '../src/renderer/engine/savedTextPresets';
import { validateSavedTextPreset } from '../src/renderer/engine/textValidation';
it('captures motion with timing/easing, restores it independently, and clears absent phases', () => {
  const source = makeTextClip('a', 't', 0), target = makeTextClip('b', 't', 7e6);
  source.animIn = { preset: 'maskRise', duration: 750000, granularity: 'line', stagger: 80000, easing: { bezier: [.22, 1, .36, 1] } };
  const preset = captureTextPreset(source); validateSavedTextPreset(preset);
  target.animLoop = { ...source.animIn, preset: 'float' };
  applyTextPreset(target, JSON.parse(JSON.stringify(preset)));
  expect(target.animIn).toEqual(source.animIn); expect(target.animLoop).toBeUndefined(); expect(target.start).toBe(7e6);
  target.animIn!.duration = 400000; expect(preset.animations!.animIn!.duration).toBe(750000);
  preset.animations!.animIn!.duration = -1; expect(() => validateSavedTextPreset(preset)).toThrow();
  applyTextPreset(target, captureTextPreset(makeTextClip('c', 't', 0))); expect(target.animIn).toBeUndefined();
});
