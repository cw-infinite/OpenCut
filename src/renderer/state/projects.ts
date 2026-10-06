import { create } from 'zustand';
import type { Project } from '../../shared/types';
import type { MediaView, ProjectSummary, ImportProgress } from '../../shared/api';

interface ProjectState {
  list: ProjectSummary[]; project: Project | null; views: MediaView[]; selected: string | null;
  progress: ImportProgress | null; busy: boolean; error: string | null; recovered: boolean;
  refresh(): Promise<void>;
  open(id: string): Promise<void>;
  setProject(project: Project): Promise<void>;
  select(id: string): void;
  close(): void;
  import(files?: File[]): Promise<void>;
  updateProgress(progress: ImportProgress): void;
  clearError(): void;
}
export const useProjects = create<ProjectState>((set, get) => ({
  list: [], project: null, views: [], selected: null, progress: null, busy: false, error: null, recovered: false,
  refresh: async () => {
    try { set({ list: await window.opencut.projects.list() }); } catch (error) { set({ error: String(error) }); }
  },
  setProject: async project => {
    const views = await window.opencut.media.views(project.id);
    const selected = get().selected;
    set({ project, views, selected: selected && project.media[selected] ? selected : views[0]?.asset.id ?? null });
    await get().refresh();
  },
  open: async id => {
    set({ busy: true, error: null });
    try { const result = await window.opencut.projects.open(id); await get().setProject(result.project); set({ recovered: result.recovered }); }
    catch (error) { set({ error: String(error) }); }
    finally { set({ busy: false }); }
  },
  select: selected => set({ selected }),
  close: () => set({ project: null, views: [], selected: null, recovered: false }),
  import: async files => {
    const project = get().project;
    if (!project || get().busy) return;
    set({ busy: true, error: null, progress: null });
    try {
      const updated = files ? await window.opencut.media.drop(project.id, files) : await window.opencut.media.pick(project.id);
      await get().setProject(updated);
    } catch (error) { set({ error: String(error) }); }
    finally { set({ busy: false }); }
  },
  updateProgress: progress => set(state => ({ progress, error: progress.error ?? state.error })),
  clearError: () => set({ error: null })
}));
