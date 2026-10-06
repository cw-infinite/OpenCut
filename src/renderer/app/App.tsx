import { useState } from 'react';
import { Setup } from './Setup';
import { Projects } from '../ui/Projects';
export function App(): JSX.Element {
  const [screen, setScreen] = useState<'setup' | 'projects'>('setup');
  return screen === 'setup' ? <Setup onContinue={() => setScreen('projects')}/> : <Projects onTools={() => setScreen('setup')}/>;
}
