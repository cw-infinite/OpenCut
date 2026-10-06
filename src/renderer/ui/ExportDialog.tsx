import { useState } from 'react';
import { Download, X, CheckCircle2, Square } from 'lucide-react';
import { useEditor } from '../state/editor';
import type { ExportRequest } from '../../shared/export';
import { useExport } from '../state/export';
import { durationOf } from '../engine/timeline';
import { makeExportPlan } from '../engine/ffmpegArgs';

export function ExportDialog({ range, onClose }: { range: { start: number; end: number }; onClose(): void }): JSX.Element {
  const project = useEditor(state => state.project)!;
  const [settings, setSettings] = useState<ExportRequest>({ projectId: project.id, resolution: 1080, fps: project.settings.fps as 30, quality: 'high', bitrateMbps: 12, audioBitrate: 192, encoderPreference: 'auto' });
  const [useRange, setUseRange] = useState(false), [error, setError] = useState('');
  const { busy, progress } = useExport();
  const setBusy = (busy: boolean) => useExport.setState({ busy });
  const request = { ...settings, range: useRange ? range : undefined };
  let dimensions = '';
  try { const plan = makeExportPlan(project, request); dimensions = `${plan.width} × ${plan.height} · ${(plan.totalFrames / plan.fps).toFixed(2)} seconds`; } catch { dimensions = 'Invalid range or canvas dimensions'; }
  const select = <K extends keyof ExportRequest>(label: string, key: K, options: { value: string | number; name: string }[]) => <label>{label}<select aria-label={label} disabled={busy} value={String(settings[key])} onChange={event => setSettings({ ...settings, [key]: typeof settings[key] === 'number' ? Number(event.target.value) : event.target.value })}>{options.map(option => <option key={option.value} value={option.value}>{option.name}</option>)}</select></label>;
  const start = async () => {
    useExport.setState({ busy: true, progress: null }); setError(''); useEditor.setState({ playing: false });
    try {
      const snapshot = useEditor.getState().project!;
      makeExportPlan(snapshot, request);
      await window.opencut.projects.saveEdit(snapshot);
      if (snapshot === useEditor.getState().project) useEditor.setState({ dirty: false });
      const job = await window.opencut.export.start(request);
      if (!job) setBusy(false);
    } catch (error) { setError(String(error)); setBusy(false); }
  };
  return <div className="modal-backdrop"><section className="modal export-modal" role="dialog" aria-label="Export video"><div className="modal-heading"><div><div className="eyebrow">READY FOR THE WORLD</div><h2>Export your video</h2></div><button aria-label="Close export" onClick={onClose}><X size={19}/></button></div>
    <div className="export-summary"><Download size={23}/><div><strong>{project.name}</strong><p>{dimensions} · MP4 / H.264</p></div></div>
    <div className="fields">{select('Resolution', 'resolution', [480, 720, 1080].map(value => ({ value, name: `${value}p` })))}{select('Export frame rate', 'fps', [24, 25, 30, 50, 60].map(value => ({ value, name: `${value} fps` })))}</div>
    <div className="fields">{select('Quality', 'quality', ['low', 'medium', 'high', 'maximum', 'custom'].map(value => ({ value, name: value[0].toUpperCase() + value.slice(1) })))}{select('Audio bitrate', 'audioBitrate', [128, 192, 256, 320].map(value => ({ value, name: `${value} kbps` })))}</div>
    {settings.quality === 'custom' && <label>Video bitrate (Mbps)<input disabled={busy} type="number" min={.1} max={100} step={.1} value={settings.bitrateMbps} onChange={event => setSettings({ ...settings, bitrateMbps: Number(event.target.value) })}/></label>}
    <button className="secondary" disabled={busy || !project.tracks.some(track => track.clips.some(clip => clip.type === 'text' && clip.caption))} title="Available when the project contains captions" onClick={async () => {
      try { await window.opencut.projects.saveEdit(project); await window.opencut.export.srt(project.id); } catch (error) { setError(String(error)); }
    }}>Export captions as SRT</button>
    {select('Encoder', 'encoderPreference', [{ value: 'auto', name: 'Automatic · test GPU, fall back to CPU' }, { value: 'software', name: 'Software · libx264' }])}
    <label className="check-row"><input type="checkbox" disabled={busy || range.end <= range.start} checked={useRange} onChange={event => setUseRange(event.target.checked)}/> Export in/out range (set with I and O)</label>
    {progress && <div className={'export-status ' + progress.stage} role="status"><div>{progress.stage === 'complete' ? <CheckCircle2 size={17}/> : <Download size={17}/>}<strong>{({ audio: 'Mixing audio', encoding: 'Rendering frames', finalizing: 'Finishing MP4', complete: 'Export complete', canceled: 'Export canceled', error: 'Export failed' })[progress.stage]}</strong><span>{Math.round(progress.frame / progress.total * 100)}%</span></div><progress max={progress.total} value={progress.frame}/><p>{progress.encoder ?? 'Local audio mix'} · {progress.frame} / {progress.total} frames{progress.etaSeconds !== null && busy ? ` · ${Math.ceil(progress.etaSeconds)}s remaining` : ''}</p>{progress.stage === 'complete' && <p className="output-path">{progress.outputPath}</p>}</div>}
    {(error || progress?.stage === 'error') && <div className="error export-error" role="alert">{error || progress?.message}</div>}
    <div className="dialog-actions">{busy ? <><button className="secondary" onClick={onClose}>Keep editing</button><button className="secondary" disabled={!progress} onClick={() => void window.opencut.export.cancel().catch(error => setError(String(error)))}><Square size={13}/> Cancel export</button></> : <><button className="secondary" onClick={onClose}>Close</button><button className="primary" disabled={durationOf(project) === 0} onClick={() => void start()}><Download size={15}/> Export MP4</button></>}</div>
    <p className="subtle export-footnote">Rendered on your computer. No watermark. Original files stay untouched.</p>
  </section></div>;
}
