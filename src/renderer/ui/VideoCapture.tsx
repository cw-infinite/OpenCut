import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../state/editor';
import { useProjects } from '../state/projects';

export function VideoCapture(): JSX.Element {
  const [open, setOpen] = useState(false), [mode, setMode] = useState<'camera' | 'screen'>('camera'), [audio, setAudio] = useState(false);
  const [sources, setSources] = useState<{ id: string; name: string; thumbnail: string }[]>([]), [source, setSource] = useState('');
  const [busy, setBusy] = useState(false), [recording, setRecording] = useState(false), [seconds, setSeconds] = useState(0), [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null), alive = useRef(true), preview = useRef<HTMLVideoElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (recorder.current?.state === 'recording') recorder.current.stop(); recorder.current?.stream.getTracks().forEach(track => track.stop()); }; }, []);
  useEffect(() => { if (!recording) return; const timer = setInterval(() => setSeconds(value => { if (value >= 299) recorder.current?.stop(); return value + 1; }), 1000); return () => clearInterval(timer); }, [recording]);
  const loadSources = async () => {
    setBusy(true); setError('');
    try { const result = await window.opencut.capture.sources(); if (alive.current) { setSources(result); setSource(result[0]?.id ?? ''); } }
    catch (error) { setError(String(error)); } finally { if (alive.current) setBusy(false); }
  };
  const start = async () => {
    const { project, playhead } = useEditor.getState(); if (!project) return;
    let stream: MediaStream | undefined; setBusy(true); setError(''); useEditor.setState({ playing: false });
    try {
      await window.opencut.capture.authorize(mode, source, audio);
      stream = mode === 'camera' ? await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio }) : await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 30 } }, audio });
      if (!alive.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type))!;
      const capture = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000, audioBitsPerSecond: 128000 }), chunks: Blob[] = [];
      recorder.current = capture; let bytes = 0, failed = false;
      capture.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); bytes += event.data.size; if (bytes >= 120 * 1024 * 1024 && capture.state === 'recording') capture.stop(); } };
      capture.onerror = () => { failed = true; stream?.getTracks().forEach(track => track.stop()); if (alive.current) { setError('Recording failed. Check the selected device and try again.'); setRecording(false); setBusy(false); } };
      capture.onstop = () => {
        stream?.getTracks().forEach(track => track.stop()); if (preview.current) preview.current.srcObject = null;
        if (!alive.current || failed) return;
        setRecording(false); setBusy(true);
        void (async () => {
          const asset = await window.opencut.media.recordVideo(project.id, await new Blob(chunks, { type: mimeType }).arrayBuffer());
          const current = useEditor.getState(); if (current.project?.id !== project.id) return;
          useEditor.setState({ project: { ...current.project, media: { ...current.project.media, [asset.id]: asset } } });
          useProjects.setState({ views: await window.opencut.media.views(project.id) }); current.addMedia(asset.id, undefined, playhead);
          if (alive.current) setOpen(false);
        })().catch(error => { if (alive.current) setError(String(error)); }).finally(() => { if (alive.current) setBusy(false); });
      };
      stream.getVideoTracks()[0].onended = () => { if (capture.state === 'recording') capture.stop(); };
      if (preview.current) { preview.current.srcObject = stream; await preview.current.play(); }
      capture.start(1000); setSeconds(0); setRecording(true);
    } catch (error) { stream?.getTracks().forEach(track => track.stop()); if (alive.current) setError(String(error)); }
    finally { if (alive.current) setBusy(false); }
  };
  return <><button className="secondary" onClick={() => setOpen(true)}>Record video</button>{open && <div className="modal-backdrop"><section className="modal capture-modal" role="dialog" aria-label="Record video"><h2>Record video</h2><p>Up to five minutes per recording. Added on a new track at the current playhead.</p><label>Capture source<select aria-label="Capture source" disabled={busy || recording} value={mode} onChange={event => { const mode = event.target.value as 'camera' | 'screen'; setMode(mode); if (mode === 'screen') void loadSources(); }}><option value="camera">Webcam</option><option value="screen">Screen or window</option></select></label>{mode === 'screen' && <><button disabled={busy || recording} onClick={() => void loadSources()}>Refresh sources</button><div className="capture-sources">{sources.map(item => <button disabled={busy || recording} className={source === item.id ? 'selected' : ''} key={item.id} onClick={() => setSource(item.id)}><img src={item.thumbnail} alt=""/><span>{item.name}</span><input readOnly type="radio" checked={source === item.id} aria-label={item.name}/></button>)}</div></>}<label className="check-row"><input type="checkbox" disabled={busy || recording} checked={audio} onChange={event => setAudio(event.target.checked)}/>{mode === 'camera' ? 'Include microphone audio' : 'Include system audio (all playing apps)'}</label><video ref={preview} muted playsInline className="capture-preview"/>{error && <p role="alert" className="error">{error}</p>}<div className="dialog-actions"><button disabled={busy || recording} onClick={() => setOpen(false)}>Close</button>{recording ? <button className="primary" onClick={() => recorder.current?.stop()}>Stop video recording · {seconds}s</button> : <button className="primary" disabled={busy || (mode === 'screen' && !source)} onClick={() => void start()}>{busy ? 'Preparing video…' : 'Start video recording'}</button>}</div></section></div>}</>;
}
