// Waveforms are disposable caches. Older builds stored { buckets, peaks };
// current imports store the samples directly. Keep malformed caches out of the UI.
export function parseWaveformCache(text: string): number[] {
  try {
    const value: unknown = JSON.parse(text);
    const peaks = Array.isArray(value) ? value : value && typeof value === 'object' && 'peaks' in value ? value.peaks : null;
    if (!Array.isArray(peaks)) return [];
    return peaks.map(peak => typeof peak === 'number' && Number.isFinite(peak) ? Math.max(0, Math.min(1, peak)) : 0);
  } catch { return []; }
}
