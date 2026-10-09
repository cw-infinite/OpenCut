import type { ExportRequest } from '../../shared/export';

export const exportPresets: Record<string, Partial<ExportRequest>> = {
  'YouTube 1080p': { format: 'mp4', aspect: 'landscape', resolution: 1080, fps: 30, quality: 'high', audioBitrate: 192 },
  'YouTube Shorts': { format: 'mp4', aspect: 'portrait', resolution: 1080, fps: 30, quality: 'high', audioBitrate: 192 },
  TikTok: { format: 'mp4', aspect: 'portrait', resolution: 1080, fps: 30, quality: 'high', audioBitrate: 192 },
  'Instagram Reels': { format: 'mp4', aspect: 'portrait', resolution: 1080, fps: 30, quality: 'high', audioBitrate: 192 },
  'WhatsApp small': { format: 'mp4', aspect: 'project', resolution: 480, fps: 30, quality: 'custom', bitrateMbps: 1.5, audioBitrate: 128 }
};
export function estimatedBytes(request: ExportRequest, duration: number): number {
  if (request.format === 'wav') return Math.ceil(duration / 1e6 * 48000 * 2 * 2);
  let videoMbps = 0;
  if (!request.format || request.format === 'mp4') videoMbps = request.quality === 'custom' ? request.bitrateMbps : ({ low: 2, medium: 4, high: 8, maximum: 16 })[request.quality] * (request.resolution / 1080) ** 2 * request.fps / 30;
  return Math.ceil(duration / 1e6 * (videoMbps * 1e6 + request.audioBitrate * 1000) / 8);
}
