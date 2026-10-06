import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ToolReport, SetupProgress } from '../../shared/api';
interface SetupState {
  report: ToolReport | null;
  progress: SetupProgress | null;
  busy: boolean;
  error: string | null;
  check(): Promise<void>;
  install(): Promise<void>;
  setProgress(progress: SetupProgress): void;
}
export const useSetup = create<SetupState>()(immer((set) => ({
  report: null, progress: null, busy: false, error: null,
  setProgress: progress => set(state => { state.progress = progress; }),
  check: async () => {
    set(state => { state.busy = true; state.error = null; });
    try { const report = await window.opencut.checkTools(); set(state => { state.report = report; }); }
    catch (error) { set(state => { state.error = String(error); }); }
    finally { set(state => { state.busy = false; }); }
  },
  install: async () => {
    set(state => { state.busy = true; state.error = null; });
    try { const report = await window.opencut.setupTools(); set(state => { state.report = report; }); }
    catch (error) { set(state => { state.error = String(error); }); }
    finally { set(state => { state.busy = false; }); }
  }
})));
