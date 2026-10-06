import { create } from 'zustand';
import type { ExportProgress } from '../../shared/export';
export const useExport = create<{ busy: boolean; progress: ExportProgress | null; update(progress: ExportProgress): void }>(set => ({
  busy: false, progress: null,
  update: progress => set({ progress, busy: !['complete', 'canceled', 'error'].includes(progress.stage) })
}));
