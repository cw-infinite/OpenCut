import { useEditor } from '../state/editor';
import { cutTimelineRange, fillerCandidates } from '../engine/rangeCut';

export function FillerWords({ disabled, onPreview }: { disabled: boolean; onPreview(): void }) {
  const state = useEditor(), candidates = fillerCandidates(state.project!);
  return <details className="filler-words"><summary>Filler-word candidates · {candidates.length}</summary>
    <p className="subtle">Detected “um” and “uh” from generated word timings. Review each candidate. Cut removes that time from all tracks and shifts later content together; Undo restores it. Locked tracks and transitions crossing the cut must be resolved first.</p>
    <button disabled={disabled || !state.history.length} onClick={state.undo}>Undo edit</button>
    {candidates.map(word => <div className="caption-actions" key={`${word.start}:${word.end}`}><span>{word.text} · {(word.start / 1e6).toFixed(2)}–{(word.end / 1e6).toFixed(2)} s</span><button disabled={disabled} onClick={() => { state.seek(word.start); onPreview(); }}>Seek to filler</button><button disabled={disabled} onClick={() => { state.edit(project => cutTimelineRange(project, word.start, word.end, () => crypto.randomUUID())); state.select([]); state.seek(word.start); }}>Cut filler</button></div>)}
    {!candidates.length && <p className="subtle">No timed “um” or “uh” found. Recognition can omit fillers; review the original audio.</p>}
  </details>;
}
