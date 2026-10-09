import type { Project } from './types';
import type { MediaView } from './api';
export type Encoder = 'libx264' | 'h264_nvenc' | 'h264_qsv' | 'h264_amf';
export type Quality = 'low' | 'medium' | 'high' | 'maximum' | 'custom';
export interface ExportRequest {
  format?: 'mp4' | 'mp3' | 'wav' | 'aac';
  projectId: string;
  resolution: 480 | 720 | 1080;
  fps: 24 | 25 | 30 | 50 | 60;
  quality: Quality;
  bitrateMbps: number;
  audioBitrate: 128 | 192 | 256 | 320;
  encoderPreference: 'auto' | 'software';
  range?: { start: number; end: number };
}
export interface ExportPlan extends ExportRequest { width: number; height: number; start: number; end: number; totalFrames: number }
export interface ExportWork { id: string; project: Project; views: MediaView[]; plan: ExportPlan }
export interface ExportProgress {
  id: string; stage: 'audio' | 'encoding' | 'finalizing' | 'complete' | 'canceled' | 'error';
  frame: number; total: number; fps: number; etaSeconds: number | null;
  outputPath: string; encoder?: Encoder; message?: string;
}
