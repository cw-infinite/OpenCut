import { useExport } from '../state/export';
export function ExportTray(): JSX.Element | null {
  const { progress, busy } = useExport();
  if (!busy || !progress) return null;
  return <div className="background-export" aria-label="Background export"><span>Export · {progress.stage} · {Math.round(progress.frame / progress.total * 100)}%</span><progress max={progress.total} value={progress.frame}/><button onClick={() => void window.opencut.export.cancel()}>Cancel</button></div>;
}
