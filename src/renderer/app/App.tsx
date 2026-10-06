import { useEffect, useState } from 'react';
import { Setup } from './Setup';
import { Projects } from '../ui/Projects';
import { useExport } from '../state/export';
import { ExportTray } from '../ui/ExportTray';
export function App(): JSX.Element {
  const [screen, setScreen] = useState<'setup' | 'projects'>('setup');
  useEffect(() => window.opencut.export.onProgress(useExport.getState().update), []);
  return <>{screen === 'setup' ? <Setup onContinue={() => setScreen('projects')}/> : <Projects onTools={() => setScreen('setup')}/>}<ExportTray/></>;
}
