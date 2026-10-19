import { expect, it } from 'vitest';
import { designedTextPresets, applyDesignedTextPreset } from '../src/renderer/engine/designedTextPresets';
import { makeTextClip } from '../src/renderer/engine/text';
import { validateText } from '../src/renderer/engine/textValidation';
it('designed presets preserve wording and timing and validate for rendering', () => {
  for (const preset of designedTextPresets) {
    const clip = makeTextClip('c', 't', 1000000);
    const content = clip.content, duration = clip.duration;
    applyDesignedTextPreset(clip, preset);
    expect(clip.content).toBe(content); expect(clip.duration).toBe(duration); expect(clip.start).toBe(1000000);
    validateText(clip);
  }
});
