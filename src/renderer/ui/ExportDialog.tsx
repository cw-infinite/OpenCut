import { useState } from 'react';
import { Download, X, CheckCircle2, Square } from 'lucide-react';
import { useEditor } from '../state/editor';
import type { ExportRequest } from '../../shared/export';
import { useExport } from '../state/export';
import { durationOf } from '../engine/timeline';
import { makeExportPlan } from '../engine/ffmpegArgs';
import { estimatedBytes, exportPresets } from '../engine/exportPresets';

export function ExportDialog({ range, onClose }: { range: { start: number; end: number }; onClose(): void }): JSX.Element {
  const project = useEditor(state => state.project)!;
  const [settings, setSettings] = useState<ExportRequest>({ format: 'mp4', projectId: project.id, resolution: 1080, fps: project.settings.fps as 30, quality: 'high', bitrateMbps: 12, audioBitrate: 192, encoderPreference: 'auto' });
  const isVideo = settings.format === 'mp4';
  const [batch, setBatch] = useState(false);
  const [resolutions, setResolutions] = useState<ExportRequest['resolution'][]>([1080, 720, 480]);
  const [useRange, setUseRange] = useState(false), [error, setError] = useState('');
  const { busy, progress } = useExport();
  const setBusy = (busy: boolean) => useExport.setState({ busy });
  const request = { ...settings, range: useRange ? range : undefined };
  let dimensions = '';
  try { const plan = makeExportPlan(project, request); dimensions = `${isVideo ? `${plan.width} × ${plan.height} · ` : '48 kHz · '}${((plan.end - plan.start) / 1e6).toFixed(2)} seconds`; } catch { dimensions = 'Invalid range or canvas dimensions'; }
  const select = <K extends keyof ExportRequest>(label: string, key: K, options: { value: string | number; name: string }[]) => <label>{label}<select aria-label={label} disabled={busy} value={String(settings[key])} onChange={event => setSettings({ ...settings, [key]: typeof settings[key] === 'number' ? Number(event.target.value) : event.target.value })}>{options.map(option => <option key={option.value} value={option.value}>{option.name}</option>)}</select></label>;
  const start = async () => {
    useExport.setState({ busy: true, progress: null }); setError(''); useEditor.setState({ playing: false });
    try {
      const snapshot = useEditor.getState().project!;
      makeExportPlan(snapshot, request);
      await window.opencut.projects.saveEdit(snapshot);
      if (snapshot === useEditor.getState().project) useEditor.setState({ dirty: false });
      const job = batch && isVideo ? await window.opencut.export.batch(resolutions.map(resolution => ({ ...request, resolution }))) : await window.opencut.export.start(request);
      if (!job) setBusy(false);
    } catch (error) { setError(String(error)); setBusy(false); }
  };
  return <div className="modal-backdrop"><section className="modal export-modal" role="dialog" aria-label="Export video"><div className="modal-heading"><div><div className="eyebrow">READY FOR THE WORLD</div><h2>Export your edit</h2></div><button aria-label="Close export" onClick={onClose}><X size={19}/></button></div>
    <div className="export-summary"><Download size={23}/><div><strong>{project.name}</strong><p>{dimensions} · {settings.format === 'mp4' ? 'MP4 / H.264' : settings.format?.toUpperCase()}</p></div></div>
    {select('Format', 'format', [{ value: 'mp4', name: 'MP4 video' }, { value: 'wav', name: 'WAV audio' }, { value: 'mp3', name: 'MP3 audio' }, { value: 'aac', name: 'AAC audio' }])}
    {isVideo && <><label>Platform preset<select aria-label="Platform preset" disabled={busy} value="" onChange={event => setSettings({ ...settings, ...exportPresets[event.target.value] })}><option value="">Choose a preset</option>{Object.keys(exportPresets).map(name => <option key={name}>{name}</option>)}</select></label><label>Output shape<select aria-label="Output shape" disabled={busy} value={settings.aspect ?? 'project'} onChange={event => setSettings({ ...settings, aspect: event.target.value as ExportRequest['aspect'] })}><option value="project">Project canvas</option><option value="landscape">Landscape · 16:9</option><option value="portrait">Portrait · 9:16</option><option value="square">Square · 1:1</option></select></label></>}
    {isVideo && <div className="fields">{select('Resolution', 'resolution', [480, 720, 1080].map(value => ({ value, name: `${value}p` })))}{select('Export frame rate', 'fps', [24, 25, 30, 50, 60].map(value => ({ value, name: `${value} fps` })))}</div>}
    <div className="fields">{isVideo && select('Quality', 'quality', ['low', 'medium', 'high', 'maximum', 'custom'].map(value => ({ value, name: value[0].toUpperCase() + value.slice(1) })))}{select('Audio bitrate', 'audioBitrate', [128, 192, 256, 320].map(value => ({ value, name: `${value} kbps` })))}</div>
    {isVideo && settings.quality === 'custom' && <label>Video bitrate (Mbps)<input disabled={busy} type="number" min={.1} max={100} step={.1} value={settings.bitrateMbps} onChange={event => setSettings({ ...settings, bitrateMbps: Number(event.target.value) })}/></label>}
    <button className="secondary" disabled={busy || !project.tracks.some(track => track.clips.some(clip => clip.type === 'text' && clip.caption))} title="Available when the project contains captions" onClick={async () => {
      try { await window.opencut.projects.saveEdit(project); await window.opencut.export.srt(project.id); } catch (error) { setError(String(error)); }
    }}>Export captions as SRT</button>
    {isVideo && select('Encoder', 'encoderPreference', [{ value: 'auto', name: 'Automatic · test GPU, fall back to CPU' }, { value: 'software', name: 'Software · libx264' }])}
    <label className="check-row"><input type="checkbox" disabled={busy || range.end <= range.start} checked={useRange} onChange={event => setUseRange(event.target.checked)}/> Export in/out range (set with I and O)</label>
    {isVideo && <><label className="check-row"><input type="checkbox" disabled={busy} checked={batch} onChange={event => setBatch(event.target.checked)}/> Batch export resolutions</label>{batch && <div className="batch-resolutions">{([1080, 720, 480] as const).map(resolution => <label className="check-row" key={resolution}><input type="checkbox" disabled={busy} checked={resolutions.includes(resolution)} onChange={event => setResolutions(event.target.checked ? [...resolutions, resolution].sort((a, b) => b - a) : resolutions.filter(value => value !== resolution))}/>{resolution}p</label>)}</div>}</>}
    <p className="subtle">Estimated size: {((batch && isVideo ? resolutions.reduce((sum, resolution) => sum + estimatedBytes({ ...request, resolution }, useRange ? range.end - range.start : durationOf(project)), 0) : estimatedBytes(request, useRange ? range.end - range.start : durationOf(project))) / 1e6).toFixed(1)} MB · approximate; content affects compression.</p>
    {progress && <div className={'export-status ' + progress.stage} role="status"><div>{progress.stage === 'complete' ? <CheckCircle2 size={17}/> : <Download size={17}/>}<strong>{({ queued: 'Preparing next output', audio: 'Mixing audio', encoding: 'Rendering frames', finalizing: 'Finishing file', complete: 'Export complete', canceled: 'Export canceled', error: 'Export failed' })[progress.stage]}</strong><span>{Math.round(progress.frame / progress.total * 100)}%</span></div><progress max={progress.total} value={progress.frame}/><p>{progress.encoder ?? 'Local audio mix'} · {progress.frame} / {progress.total} frames{progress.etaSeconds !== null && busy ? ` · ${Math.ceil(progress.etaSeconds)}s remaining` : ''}</p>{progress.stage === 'complete' && <p className="output-path">{progress.outputPath}</p>}</div>}
    {progress?.batch && <div className="batch-outputs"><p>Output {progress.batch.index} of {progress.batch.total}</p>{progress.batch.outputs.map(path => <p className="output-path" key={path}>{path}</p>)}</div>}{(error || progress?.stage === 'error') && <div className="error export-error" role="alert">{error || progress?.message}</div>}
    <div className="dialog-actions">{busy ? <><button className="secondary" onClick={onClose}>Keep editing</button><button className="secondary" disabled={!progress} onClick={() => void window.opencut.export.cancel().catch(error => setError(String(error)))}><Square size={13}/> Cancel export</button></> : <><button className="secondary" onClick={onClose}>Close</button><button className="primary" disabled={durationOf(project) === 0 || (batch && isVideo && !resolutions.length)} onClick={() => void start()}><Download size={15}/> {batch && isVideo ? 'Export batch' : settings.format === 'mp4' ? 'Export MP4' : 'Export audio'}</button></>}</div>
    <p className="subtle export-footnote">Rendered on your computer. No watermark. Original files stay untouched.</p>
  </section></div>;
}
