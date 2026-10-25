import { describe, expect, it } from 'vitest';
import { alignPreview } from '../src/renderer/engine/previewAlignment';

describe('preview alignment', () => {
  it('snaps each axis independently to canvas and other element centers', () => {
    const result = alignPreview([{ x: .2, y: .2 }], [{ x: .8, y: .7 }], { x: .295, y: .495 }, { width: 1000, height: 500 });
    expect(result.x).toBeCloseTo(.3); expect(result.y).toBeCloseTo(.5);
    expect(result.guides).toEqual([{ axis: 'x', position: .5, canvas: true }, { axis: 'y', position: .7, canvas: false }]);
  });
  it('uses a screen-pixel threshold and supports free positioning', () => {
    const points = [{ x: .49, y: .2 }], delta = { x: 0, y: 0 };
    expect(alignPreview(points, [], delta, { width: 500, height: 500 }).guides).toHaveLength(1);
    expect(alignPreview(points, [], delta, { width: 1000, height: 500 }).guides).toHaveLength(0);
    expect(alignPreview(points, [], delta, { width: 500, height: 500 }, true)).toEqual({ ...delta, guides: [] });
  });
});
