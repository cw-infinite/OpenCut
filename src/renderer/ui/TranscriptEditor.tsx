import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../state/editor';
import { deleteTranscriptWords, transcriptRanges, transcriptWords } from '../engine/transcript';

export function TranscriptEditor({ disabled, onPreview }: { disabled: boolean; onPreview(): void }): JSX.Element {
  const state = useEditor(), project = state.project!;
  const tracks = project.tracks.filter(track => track.clips.some(clip => clip.type === 'text' && clip.caption));
  const [trackId, setTrackId] = useState(''), [selected, setSelected] = useState<string[]>([]);
  const active = tracks.some(track => track.id === trackId) ? trackId : tracks[0]?.id ?? '';
  const words = transcriptWords(project, active), ranges = transcriptRanges(words, selected), anchor = useRef<string | null>(null);
  useEffect(() => { setSelected([]); anchor.current = null; }, [project, active]);
  const toggle = (id: string, range: boolean) => {
    const first = words.findIndex(word => word.id === anchor.current), last = words.findIndex(word => word.id === id);
    if (range && first >= 0) setSelected(current => [...new Set([...current, ...words.slice(Math.min(first, last), Math.max(first, last) + 1).map(word => word.id)])]);
    else { setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); anchor.current = id; }
  };
  return <details className="transcript-editor"><summary>Edit video by transcript</summary><p className="subtle">Select timed words to remove their audio/video intervals from every track. Click to toggle; Shift-click selects a word range. Gaps between words remain. Review recognition and timing first. Undo restores the cut.</p><label>Transcript track<select aria-label="Transcript track" value={active} disabled={disabled} onChange={event => setTrackId(event.target.value)}>{tracks.map(track => <option key={track.id} value={track.id}>{track.name}</option>)}</select></label><div className="transcript-words" role="group" aria-label="Timed transcript words">{words.map(word => <button key={word.id} disabled={disabled} aria-pressed={selected.includes(word.id)} title={`${(word.start / 1e6).toFixed(2)}–${(word.end / 1e6).toFixed(2)} s`} onClick={event => toggle(word.id, event.shiftKey)}>{word.text}</button>)}</div>{!words.length && <p>Generate captions to get word timings. Imported SRT and manually edited captions cannot drive word cuts.</p>}<p>{selected.length} words selected · {(ranges.reduce((sum, range) => sum + range.end - range.start, 0) / 1e6).toFixed(2)} seconds to remove</p><div className="caption-actions"><button disabled={disabled || !ranges.length} onClick={() => { state.seek(ranges[0].start); onPreview(); }}>Preview selected words</button><button className="secondary" disabled={disabled || !selected.length} onClick={() => setSelected([])}>Clear word selection</button><button className="primary" disabled={disabled || !selected.length} onClick={() => { const before = useEditor.getState().project; state.edit(project => deleteTranscriptWords(project, active, selected, () => crypto.randomUUID())); if (before !== useEditor.getState().project) { state.select([]); state.seek(ranges[0].start); } }}>Delete selected words</button><button disabled={disabled || !state.history.length} onClick={state.undo}>Undo transcript edit</button></div></details>;
}
