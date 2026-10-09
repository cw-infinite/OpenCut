import { describe, expect, it } from 'vitest';
import { makeMediaClip } from '../src/renderer/engine/timeline';
import { filterPresets, processPixels, maskAlpha, effectMotion } from '../src/renderer/engine/visualEffects';
import { validateVisuals } from '../src/renderer/engine/visualValidation';

const clip = () => makeMediaClip('c', { id: 'm', kind: 'image', duration: 5e6, path: 'C:/image.png', status: 'ready', hasAudio: false }, 't', 0);
describe('visual effects', () => {
  it('preserves unadjusted pixels and gives every filter a visible, intensity-controlled result', () => {
    const original = new Uint8ClampedArray([80, 130, 190, 255, 190, 60, 30, 180]), c = clip(), unchanged = original.slice();
    processPixels(unchanged, 2, 1, c, 0); expect(unchanged).toEqual(original);
    for (const preset of filterPresets) {
      c.filter = { preset, intensity: 1 }; const changed = original.slice(); processPixels(changed, 2, 1, c, 0);
      expect(changed).not.toEqual(original); expect(changed[3]).toBe(255); expect(changed[7]).toBe(180);
      c.filter.intensity = 0; const bypass = original.slice(); processPixels(bypass, 2, 1, c, 0); expect(bypass).toEqual(original);
    }
    c.filter = { preset: 'B&W', intensity: 1 }; const gray = original.slice(); processPixels(gray, 2, 1, c, 0); expect(gray[0]).toBe(gray[1]); expect(gray[1]).toBe(gray[2]);
  });
  it('removes bright and dark green while keeping neutral and red foreground', () => {
    const c = clip(); c.chromaKey = { color: '#00ff00', similarity: .15, smoothness: .12, spill: .6 };
    const pixels = new Uint8ClampedArray([0, 255, 0, 255, 0, 100, 0, 255, 255, 0, 0, 255, 128, 128, 128, 255]);
    processPixels(pixels, 4, 1, c, 0); expect([pixels[3], pixels[7], pixels[11], pixels[15]]).toEqual([0, 0, 255, 255]);
  });
  it('sharpens local contrast while leaving uniform regions unchanged', () => {
    const c = clip(); c.adjust.sharpen = 1;
    const pixels = new Uint8ClampedArray(5 * 5 * 4).fill(50); pixels[(2 * 5 + 2) * 4] = 100;
    processPixels(pixels, 5, 5, c, 0); expect(pixels[(2 * 5 + 2) * 4]).toBe(220); expect(pixels[0]).toBe(50);
  });
  it('feathers and inverts masks, keeps motion deterministic and validates persisted settings', () => {
    const c = clip(), mask = { shape: 'ellipse' as const, x: .5, y: .5, width: .5, height: .5, rotation: 0, feather: .2, invert: false };
    expect(maskAlpha(mask, .5, .5)).toBe(1); expect(maskAlpha(mask, 0, 0)).toBe(0); expect(maskAlpha(mask, .75, .5)).toBeCloseTo(.5);
    mask.invert = true; expect(maskAlpha(mask, .5, .5)).toBe(0);
    c.effects = [{ type: 'shake', enabled: true, params: { amount: .5 } }, { type: 'grain', enabled: true, params: { amount: 1 } }];
    expect(effectMotion(c, 100000)).toEqual(effectMotion(c, 100000)); expect(effectMotion(c, 100000)).not.toEqual(effectMotion(c, 200000));
    const original = new Uint8ClampedArray(16 * 16 * 4).fill(128), first = original.slice(), second = original.slice();
    processPixels(first, 16, 16, c, 100000); processPixels(second, 16, 16, c, 100000); expect(first).toEqual(second); expect(first).not.toEqual(original);
    c.mask = mask; validateVisuals(c); c.mask.width = 0; expect(() => validateVisuals(c)).toThrow(/mask size/);
  });
});
