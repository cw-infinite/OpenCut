import { useEffect } from 'react';
import { ArrowDownToLine, Check, ChevronRight, Clapperboard, Cpu, Film, Folder, HardDrive, LockKeyhole, RefreshCw, Scissors, Sparkles, Waves } from 'lucide-react';
import { useSetup } from '../state/setup';

export function Setup({ onContinue }: { onContinue?: () => void }): JSX.Element {
  const { report, busy, error, progress, check, install, setProgress } = useSetup();
  useEffect(() => { void check(); return window.opencut.onSetupProgress(setProgress); }, [check, setProgress]);
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Scissors size={23}/></span>OpenCut<span className="alpha">DEV</span></div>
      <div className="workspace-label">YOUR WORKSPACE</div>
      <div className="nav-item selected"><Clapperboard size={18}/> Getting started</div>
      <button className="nav-item" disabled={!report?.ready} onClick={onContinue}><Folder size={18}/> Projects</button>
      <div className="sidebar-bottom"><span className="local-dot"/> Your files stay yours.<p>No accounts. No cloud. Just create.</p><div className="version">OpenCut 0.10.0 · Windows desktop</div></div>
    </aside>
    <main className="main">
      <header className="topbar"><span>Workspace <ChevronRight size={14}/> Getting started</span><span className="privacy"><LockKeyhole size={13}/> Local by design</span></header>
      <div className="onboarding">
        <div className="eyebrow"><span/> MEET YOUR NEW EDITING SPACE</div>
        <h1>Big ideas.<br/><span>Entirely on your machine.</span></h1>
        <p className="intro">Welcome to OpenCut. Set up your local creative tools and get your<br className="wide-break"/> workspace ready for video, sound, and stories.</p>
        <div className="feature-strip">
          <div><Film size={19}/><span>Made for your footage</span></div><div><Waves size={19}/><span>Powered by local tools</span></div><div><Sparkles size={19}/><span>Free to create</span></div>
        </div>
        <section className="setup-card" aria-label="Local tools setup">
          <div className="card-header"><div className="tool-icon"><Cpu size={23}/></div><div><h2>Prepare your workspace</h2><p>A quick check of the tools that run on your computer.</p></div><span className={'status-pill ' + (report?.ready ? 'ready' : '')}>{report?.ready ? 'Tools OK' : busy ? 'Checking / setting up' : 'Setup needed'}</span></div>
          <div className="tool-list">{(report?.tools ?? [
            { id: 'ffmpeg', name: 'FFmpeg', ready: false, detail: 'Checking video processing tools…' },
            { id: 'ffprobe', name: 'FFprobe', ready: false, detail: 'Checking media inspection tools…' },
            { id: 'whisper', name: 'Whisper.cpp', ready: false, detail: 'Checking offline speech engine…' },
            { id: 'model', name: 'English speech model', ready: false, detail: 'Checking base.en model…' }
          ]).map(tool => <div className="tool-row" key={tool.id}><span className={'check-icon ' + (tool.ready ? 'complete' : '')}>{tool.ready ? <Check size={14}/> : <ArrowDownToLine size={14}/>}</span><div><strong>{tool.name}</strong><p title={tool.detail}>{tool.detail}</p></div><span className="tool-state">{tool.ready ? 'Ready' : 'Required'}</span></div>)}</div>
          {progress && busy && <div className="download-progress" role="status"><div>{progress.detail}<span>{progress.percent ?? '…'}%</span></div><progress max={100} value={progress.percent ?? undefined}/></div>}
          {error && <div className="error" role="alert">{error}</div>}
          <div className="card-footer"><div><HardDrive size={16}/><span>{report?.ready ? 'All tools are installed. No connection needed.' : 'One-time download · approximately 160 MB'}</span></div>{report?.ready ? <button className="secondary" disabled={busy} onClick={() => void check()}><RefreshCw size={15}/> Check again</button> : <button className="primary" disabled={busy || !report} onClick={() => void install()}><ArrowDownToLine size={16}/>{busy ? 'Working…' : 'Set up local tools'}</button>}</div>
        </section>
        <div className="milestone-note"><span className="phase">LOCAL WORKSPACE</span><p>Your media stays on this computer.<br/>Open Projects to organize and prepare your footage.</p>{report?.ready && <button className="primary" onClick={onContinue}>Open projects <ChevronRight size={15}/></button>}</div>
      </div>
      <footer className="workspace-footer"><span><span className="local-dot"/> Local workspace</span><span>Built for creative freedom.</span></footer>
    </main>
  </div>;
}
