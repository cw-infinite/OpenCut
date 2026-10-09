import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../state/editor';
import { useProjects } from '../state/projects';
export function Voiceover(): JSX.Element {
  const recorder = useRef<MediaRecorder | null>(null), alive = useRef(true);
  const [recording, setRecording] = useState(false), [busy, setBusy] = useState(false), [seconds, setSeconds] = useState(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (recorder.current?.state === 'recording') recorder.current.stop(); recorder.current?.stream.getTracks().forEach(track => track.stop()); }; }, []);
  useEffect(() => { if (!recording) return; const timer = setInterval(() => setSeconds(value => { if (value >= 1799) recorder.current?.stop(); return value + 1; }), 1000); return () => clearInterval(timer); }, [recording]);
  const start = async () => {
    const snapshot = useEditor.getState(), projectId = snapshot.project!.id;
    let stream: MediaStream | undefined;
    setBusy(true);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const capture = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 }), chunks: Blob[] = [];
      recorder.current = capture; let size = 0, failed = false;
      capture.onerror = () => { failed = true; stream?.getTracks().forEach(track => track.stop()); if (alive.current) { setRecording(false); setBusy(false); useEditor.setState({ error: 'Microphone recording failed. Check the selected input device and try again.' }); } };
      capture.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); size += event.data.size; if (size > 60 * 1024 * 1024 && capture.state === 'recording') capture.stop(); } };
      capture.onstop = () => {
        stream?.getTracks().forEach(track => track.stop()); if (!alive.current || failed) return;
        setRecording(false); setBusy(true);
        void (async () => {
          const asset = await window.opencut.media.record(projectId, await new Blob(chunks, { type: capture.mimeType }).arrayBuffer());
          const current = useEditor.getState(); if (current.project?.id !== projectId) return;
          useEditor.setState({ project: { ...current.project, media: { ...current.project.media, [asset.id]: asset } } });
          useProjects.setState({ views: await window.opencut.media.views(projectId) });
          current.addMedia(asset.id, undefined, snapshot.playhead);
        })().catch(error => useEditor.setState({ error: String(error) })).finally(() => { if (alive.current) setBusy(false); });
      };
      capture.start(1000); setSeconds(0); setRecording(true);
    } catch (error) { stream?.getTracks().forEach(track => track.stop()); useEditor.setState({ error: `Microphone recording: ${String(error)}` }); }
    finally { if (alive.current) setBusy(false); }
  };
  return <button className={recording ? 'primary' : 'secondary'} disabled={busy} onClick={() => recording ? recorder.current?.stop() : void start()}>{busy ? 'Preparing audio…' : recording ? `Stop recording · ${seconds}s` : 'Record voiceover'}</button>;
}
