import { describe, expect, it } from 'vitest';
import { parseWaveformCache } from '../src/main/services/waveformCache';

describe('waveform cache compatibility', () => {
  it('reads both the current array and older wrapped samples', () => {
    expect(parseWaveformCache('[0,0.5,1]')).toEqual([0, .5, 1]);
    expect(parseWaveformCache('{"buckets":3,"peaks":[0,0.5,1]}')).toEqual([0, .5, 1]);
  });
  it('ignores damaged caches rather than preventing a project from opening', () => {
    for (const text of ['[0.1,', 'null', '{}', '{"peaks":{}}', '42']) expect(parseWaveformCache(text)).toEqual([]);
    expect(parseWaveformCache('[null,"bad",{},-1,2,0.5]')).toEqual([0, 0, 0, 0, 1, .5]);
  });
});
