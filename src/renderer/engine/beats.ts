// Energy onsets are beat candidates; a short refractory period rejects duplicate hits.
export function detectOnsets(energy: number[], stepUs = 10000): number[] {
  const flux = energy.map((value, index) => Math.max(0, value - (energy[index - 1] ?? 0)));
  const candidates: { time: number; strength: number }[] = [];
  for (let i = 2; i < flux.length - 2; i++) {
    const window = flux.slice(Math.max(0, i - 50), Math.min(flux.length, i + 51));
    const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
    const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / window.length;
    if (flux[i] > Math.max(.00001, mean + Math.sqrt(variance) * 1.5) && flux[i] >= flux[i - 1] && flux[i] > flux[i + 1]) candidates.push({ time: i * stepUs, strength: flux[i] });
  }
  const chosen: typeof candidates = [];
  for (const candidate of candidates.sort((a, b) => b.strength - a.strength)) if (chosen.every(item => Math.abs(item.time - candidate.time) >= 180000)) chosen.push(candidate);
  return chosen.sort((a, b) => a.time - b.time).map(item => item.time);
}
