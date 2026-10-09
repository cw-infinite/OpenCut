import { useEffect, useState } from 'react';
import type { CaptionCue } from '../../shared/captions';
import type { TextClip } from '../../shared/types';
import { useEditor } from '../state/editor';
import { captionClip, chunkWords, parseSrt } from '../engine/captionImport';
import { editable, makeTrack } from '../engine/timeline';
import { textStyles } from '../engine/text';
import { mergeCaption, splitCaption } from '../engine/captionEdits';
import { captionPresets, styleCaption } from '../engine/captionStyle';
import { FillerWords } from './FillerWords';

export function CaptionsDialog({ range, onClose }: { range: { start: number; end: number }; onClose(): void }) {
  const state = useEditor(), project = state.project!;
  const [model, setModel] = useState<'base.en' | 'small.en'>('base.en'), [models, setModels] = useState({ 'base.en': false, 'small.en': false }), [installing, setInstalling] = useState(false);
  useEffect(() => { void window.opencut.captions.models().then(setModels).catch(error => setError(String(error))); return window.opencut.onSetupProgress(progress => setStatus(`${progress.stage} · ${progress.percent ?? 0}%`)); }, []);
  const [source, setSource] = useState('timeline'), [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('');
  const [lines, setLines] = useState(2), [chars, setChars] = useState(32), [words, setWords] = useState(6), [position, setPosition] = useState(.85), [style, setStyle] = useState('Subtitle');
  const [find, setFind] = useState(''), [replace, setReplace] = useState('');
  useEffect(() => window.opencut.captions.onProgress(progress => setStatus(`${progress.stage} · ${progress.percent}%`)), []);
  const clips = project.tracks.flatMap(track => track.clips.filter((clip): clip is TextClip => clip.type === 'text' && Boolean(clip.caption))).sort((a, b) => a.start - b.start);
  const selected = project.tracks.flatMap(track => track.clips).find(clip => state.selected.includes(clip.id) && clip.type === 'media' && project.media[clip.mediaId]?.hasAudio);
  const restyle = (clip: TextClip) => styleCaption(clip, style, position);
  const add = (cues: CaptionCue[]) => {
    if (!cues.length) { setStatus('No speech captions found.'); return; }
    state.edit(project => {
      const track = makeTrack(crypto.randomUUID(), 'text', 'Captions');
      track.clips = cues.map(cue => { const clip = captionClip(cue, track.id, crypto.randomUUID(), position); restyle(clip); return clip; });
      project.tracks.push(track);
    });
    setStatus(`Added ${cues.length} captions`);
  };
  const generate = async () => {
    setBusy(true); setError(''); useEditor.setState({ playing: false });
    try {
      await window.opencut.projects.saveEdit(project);
      const result = await window.opencut.captions.generate({ projectId: project.id, model, clipId: source === 'clip' ? selected?.id : undefined, range: source === 'range' ? range : undefined });
      add(chunkWords(result, chars, words, lines));
    } catch (error) { setError(String(error)); } finally { setBusy(false); }
  };
  const edit = (id: string, recipe: (clip: TextClip) => void) => state.edit(project => { const { clip } = editable(project, id); if (clip.type === 'text') recipe(clip); project.tracks.forEach(track => track.clips.sort((a, b) => a.start - b.start)); });
  return <div className="modal-backdrop"><section className="modal captions-modal" role="dialog" aria-label="Captions">
    <div className="modal-heading"><div><div className="eyebrow">OFFLINE SPEECH TO TEXT</div><h2>Captions</h2></div><button disabled={busy} aria-label="Close captions" onClick={onClose}>×</button></div>
    <p className="subtle">English · local speech model. Review recognition and timing before exporting.</p>
    <div className="fields"><label>Speech model<select aria-label="Speech model" disabled={busy || installing} value={model} onChange={event => setModel(event.target.value as typeof model)}><option value="base.en">base.en · faster</option><option value="small.en">small.en · more accurate</option></select></label><label>Speech source<select aria-label="Speech source" disabled={busy} value={source} onChange={event => setSource(event.target.value)}><option value="timeline">Audible timeline mix</option><option value="clip" disabled={!selected}>Selected audio/video clip</option><option value="range" disabled={range.end <= range.start}>In/out range</option></select></label>
      <label>Caption position<select aria-label="Caption position" value={position} onChange={event => setPosition(Number(event.target.value))}><option value={.15}>Top</option><option value={.5}>Middle</option><option value={.85}>Bottom</option></select></label>
      <label>Caption style<select aria-label="Caption style" value={style} onChange={event => setStyle(event.target.value)}>{[...Object.keys(captionPresets), ...Object.keys(textStyles)].map(name => <option key={name}>{name}</option>)}</select></label></div>
    <div className="fields"><label>Maximum lines<input aria-label="Maximum caption lines" type="number" min={1} max={4} value={lines} onChange={event => setLines(Number(event.target.value))}/></label><label>Characters per line<input aria-label="Characters per line" type="number" min={8} max={80} value={chars} onChange={event => setChars(Number(event.target.value))}/></label><label>Words per caption<input aria-label="Words per caption" type="number" min={1} max={20} value={words} onChange={event => setWords(Number(event.target.value))}/></label></div>
    {!models[model] && <div className="caption-actions"><span className="subtle">{model} is not installed. Download once, then use it offline.</span><button disabled={busy || installing} onClick={async () => { setInstalling(true); setError(''); try { await window.opencut.setupTools(model === 'small.en'); setModels(await window.opencut.captions.models()); } catch (error) { setError(String(error)); } finally { setInstalling(false); } }}>{installing ? 'Downloading model…' : 'Download speech model'}</button></div>}
    <div className="caption-actions"><button className="primary" disabled={busy || installing || !models[model] || (source === 'clip' && !selected)} onClick={() => void generate()}>Generate captions</button><button className="secondary" disabled={busy} onClick={async () => { setError(''); try { const raw = await window.opencut.captions.importSrt(); if (raw !== null) add(parseSrt(raw)); } catch (error) { setError(String(error)); } }}>Import SRT</button><button className="secondary" disabled={busy || !clips.length} onClick={async () => { try { await window.opencut.projects.saveEdit(useEditor.getState().project!); await window.opencut.export.srt(project.id); } catch (error) { setError(String(error)); } }}>Save SRT</button>{busy && <button onClick={() => void window.opencut.captions.cancel()}>Cancel generation</button>}</div>
    {status && <p role="status">{status}</p>}{(error || state.error) && <div role="alert" className="error">{error || state.error}</div>}
    {!!clips.length && <><div className="caption-actions"><input aria-label="Find caption text" placeholder="Find text" value={find} onChange={event => setFind(event.target.value)}/><input aria-label="Replace caption text" placeholder="Replace with" value={replace} onChange={event => setReplace(event.target.value)}/><button disabled={busy || !find} onClick={() => state.edit(project => { for (const track of project.tracks) if (!track.locked) for (const clip of track.clips) if (clip.type === 'text' && clip.caption && clip.content.includes(find)) { clip.content = clip.content.split(find).join(replace); clip.caption.words = []; } })}>Replace all</button><button disabled={busy} onClick={() => state.edit(project => { for (const track of project.tracks) if (!track.locked) for (const clip of track.clips) if (clip.type === 'text' && clip.caption) restyle(clip); })}>Restyle all</button></div>
      <p className="subtle">Locked tracks are protected. Word animations require generated word timings. Text edits clear word timings; drag timeline edges to trim, or change start/duration below.</p></>}
    {!!clips.length && <FillerWords disabled={busy} onPreview={onClose}/>}
    <div className="caption-list">{clips.map((clip, i) => <div className="caption-row" key={clip.id}>
      <button title="Seek to caption" onClick={() => { state.seek(clip.start); state.select([clip.id]); }}>{i + 1}</button>
      <textarea aria-label={`Caption ${i + 1} text`} value={clip.content} disabled={busy} onChange={event => edit(clip.id, clip => { clip.content = event.target.value; clip.caption!.words = []; })}/>
      <label>Start (s)<input aria-label={`Caption ${i + 1} start`} type="number" min={0} step={.01} value={clip.start / 1e6} disabled={busy} onChange={event => edit(clip.id, clip => { clip.start = Math.round(Number(event.target.value) * 1e6); })}/></label>
      <label>Duration (s)<input aria-label={`Caption ${i + 1} duration`} type="number" min={.01} step={.01} value={clip.duration / 1e6} disabled={busy} onChange={event => edit(clip.id, clip => { clip.duration = Math.round(Number(event.target.value) * 1e6); clip.caption!.words = []; })}/></label>
      <div><button disabled={busy} onClick={() => state.edit(project => mergeCaption(project, clip.id))}>Merge next</button><button disabled={busy || clip.content.trim().split(/\s+/).length < 2} onClick={() => state.edit(project => splitCaption(project, clip.id, crypto.randomUUID()))}>Split caption</button><button disabled={busy} onClick={() => state.edit(project => { const { track } = editable(project, clip.id); track.clips = track.clips.filter(item => item.id !== clip.id); })}>Delete caption</button></div>
    </div>)}</div>
  </section></div>;
}
