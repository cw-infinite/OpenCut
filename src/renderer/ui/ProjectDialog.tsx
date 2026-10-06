import { useState } from 'react';
import { X } from 'lucide-react';
import type { Project } from '../../shared/types';
import { frameRates } from '../../shared/project';

const ratios = [{ name: 'Landscape · 16:9', width: 1920, height: 1080 }, { name: 'Portrait · 9:16', width: 1080, height: 1920 },
  { name: 'Square · 1:1', width: 1080, height: 1080 }, { name: 'Social · 4:5', width: 864, height: 1080 }];
export function ProjectDialog({ project, onClose, onSave }: { project?: Project; onClose(): void; onSave(name: string, settings: Project['settings']): Promise<void> }): JSX.Element {
  const [name, setName] = useState(project?.name ?? 'Untitled project');
  const [settings, setSettings] = useState<Project['settings']>(project?.settings ?? { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <div className="modal-backdrop"><form className="modal" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSave(name, settings); onClose(); } catch (error) { setError(String(error)); } finally { setBusy(false); }
  }}><div className="modal-heading"><h2>{project ? 'Project settings' : 'A new story starts here'}</h2><button aria-label="Close" type="button" disabled={busy} onClick={onClose}><X size={19}/></button></div>
    <label>Project name<input autoFocus required maxLength={120} value={name} onChange={event => setName(event.target.value)}/></label>
    <label>Canvas preset<select value={ratios.find(ratio => ratio.width === settings.width && ratio.height === settings.height)?.name ?? 'Custom'} onChange={event => {
      const ratio = ratios.find(ratio => ratio.name === event.target.value);
      if (ratio) setSettings({ ...settings, width: ratio.width, height: ratio.height });
    }}>{ratios.map(ratio => <option key={ratio.name}>{ratio.name}</option>)}<option>Custom</option></select></label>
    <div className="fields"><label>Width<input type="number" min={64} max={1920} step={2} value={settings.width} onChange={event => setSettings({ ...settings, width: Number(event.target.value) })}/></label><label>Height<input type="number" min={64} max={1920} step={2} value={settings.height} onChange={event => setSettings({ ...settings, height: Number(event.target.value) })}/></label><label>Frame rate<select disabled={Boolean(project && Object.keys(project.media).length)} value={settings.fps} onChange={event => setSettings({ ...settings, fps: Number(event.target.value) })}>{frameRates.map(fps => <option key={fps} value={fps}>{fps} fps</option>)}</select></label></div>
    <p className="subtle">Up to 1920 × 1080, or 1080 × 1920 for vertical video. Frame rate locks after import so proxies stay frame accurate.</p>
    {error && <div className="error" role="alert">{error}</div>}
    <div className="dialog-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : project ? 'Save changes' : 'Create project'}</button></div>
  </form></div>;
}
