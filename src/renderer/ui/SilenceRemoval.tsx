import { useState } from 'react';
import type { MediaClip, Project } from '../../shared/types';
import { useEditor } from '../state/editor';
import { cutTimelineRange } from '../engine/rangeCut';

export function SilenceRemoval({ clip }: { clip: MediaClip }): JSX.Element {
  const state = useEditor(), [busy, setBusy] = useState(false), [threshold, setThreshold] = useState(-40), [minimum, setMinimum] = useState(.4);
  const [result, setResult] = useState<{ project: Project; gaps: { start: number; end: number }[] } | null>(null), [error, setError] = useState('');
  const analyze = async () => {
    const project = useEditor.getState().project!; setBusy(true); setError(''); setResult(null); useEditor.setState({ playing: false });
    try { await window.opencut.projects.saveEdit(project); const gaps = await window.opencut.media.silence(project.id, clip.id, threshold, minimum); setResult({ project, gaps: gaps.map(gap => ({ start: gap.start + 50000, end: gap.end - 50000 })).filter(gap => gap.end > gap.start) }); }
    catch (error) { setError(String(error)); } finally { setBusy(false); }
  };
  return <details><summary>Remove silence</summary><label>Silence threshold (dB)<input type="number" min={-80} max={-10} value={threshold} onChange={event => { setThreshold(Number(event.target.value)); setResult(null); }}/></label><label>Minimum silence (seconds)<input type="number" min={.1} max={5} step={.1} value={minimum} onChange={event => { setMinimum(Number(event.target.value)); setResult(null); }}/></label><button disabled={busy} onClick={() => void analyze()}>{busy ? 'Analyzing…' : 'Analyze silence'}</button>{result && <><p>{result.gaps.length} quiet intervals · {(result.gaps.reduce((sum, gap) => sum + gap.end - gap.start, 0) / 1e6).toFixed(2)} seconds to remove.</p><p className="subtle">Keeps 50 ms at each edge. Removes these intervals from every track and shifts later content together. Undo restores the edit.</p>{result.gaps.map(gap => <button key={gap.start} onClick={() => state.seek(gap.start)}>{(gap.start / 1e6).toFixed(2)}–{(gap.end / 1e6).toFixed(2)} s</button>)}<button disabled={!result.gaps.length || result.project !== state.project} onClick={() => { state.edit(project => { for (const gap of [...result.gaps].reverse()) cutTimelineRange(project, gap.start, gap.end, () => crypto.randomUUID()); }); if (!useEditor.getState().error) { setResult(null); state.select([]); state.seek(clip.start); } }}>Remove detected silence</button>{result.project !== state.project && <p>Timeline changed; analyze again before removing silence.</p>}</>}{error && <p role="alert">{error}</p>}</details>;
}
