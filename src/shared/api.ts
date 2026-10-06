import type { Project, MediaAsset } from './types';
import type { ExportRequest, ExportProgress, ExportWork } from './export';
export interface ProjectSummary { id: string; name: string; updatedAt: string; mediaCount: number; settings: Project['settings'] }
export interface MediaView { asset: MediaAsset; url: string; thumbnail?: string; peaks: number[] }
export interface ImportProgress { projectId: string; name: string; stage: string; percent: number; error?: string }
export interface ToolCheck {
  id: 'ffmpeg' | 'ffprobe' | 'whisper' | 'model';
  name: string;
  ready: boolean;
  detail: string;
}
export interface ToolReport { ready: boolean; tools: ToolCheck[]; checkedAt: string }
export interface SetupProgress { stage: string; percent: number | null; detail: string }
export interface OpenCutApi {
  export: {
    start(request: ExportRequest): Promise<{ id: string; outputPath: string } | null>;
    cancel(): Promise<void>;
    srt(projectId: string): Promise<string | null>;
    onProgress(callback: (progress: ExportProgress) => void): () => void;
    work(): Promise<ExportWork>;
    frame(index: number, bytes: ArrayBuffer): Promise<void>;
    finish(): Promise<void>;
    workerError(message: string): Promise<void>;
  };
  projects: {
    list(): Promise<ProjectSummary[]>;
    create(name: string, settings: Project['settings']): Promise<Project>;
    open(id: string): Promise<{ project: Project; recovered: boolean }>;
    rename(id: string, name: string): Promise<Project>;
    settings(id: string, settings: Project['settings']): Promise<Project>;
    duplicate(id: string): Promise<Project>;
    remove(id: string): Promise<void>;
    last(): Promise<string | null>;
    saveEdit(project: Project): Promise<Project>;
  };
  media: {
    pick(projectId: string): Promise<Project>;
    drop(projectId: string, files: File[]): Promise<Project>;
    views(projectId: string): Promise<MediaView[]>;
    remove(projectId: string, assetId: string): Promise<Project>;
    onProgress(callback: (progress: ImportProgress) => void): () => void;
  };
  checkTools(): Promise<ToolReport>;
  setupTools(): Promise<ToolReport>;
  onSetupProgress(callback: (progress: SetupProgress) => void): () => void;
}
declare global { interface Window { opencut: OpenCutApi } }
