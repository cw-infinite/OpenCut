import { extname } from 'node:path';
import { runProcess } from './process';
import { ffprobePath } from './tools';
import type { MediaAsset } from '../../shared/types';

export const mediaExtensions = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'jpg', 'jpeg', 'png', 'webp', 'gif'];
const images = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
export async function probe(path: string, id: string): Promise<MediaAsset> {
  if (!mediaExtensions.includes(extname(path).toLowerCase().slice(1))) throw new Error('Unsupported file type');
  const raw = await runProcess(ffprobePath, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], 30000);
  const data = JSON.parse(raw);
  const video = data.streams?.find((stream: { codec_type: string }) => stream.codec_type === 'video');
  const audio = data.streams?.some((stream: { codec_type: string }) => stream.codec_type === 'audio');
  if (!video && !audio) throw new Error('No readable audio or video streams');
  const kind = images.has(extname(path).toLowerCase()) ? 'image' : video ? 'video' : 'audio';
  const [num, den] = String(video?.avg_frame_rate ?? '0/1').split('/').map(Number);
  const duration = kind === 'image' ? 5_000_000 : Math.round(Number(data.format?.duration ?? video?.duration ?? 0) * 1_000_000);
  if (!Number.isSafeInteger(duration) || duration <= 0) throw new Error('Media has no valid duration');
  return { id, path, kind, duration, width: video?.width, height: video?.height, fps: den ? num / den : undefined,
    hasAudio: Boolean(audio), rotation: Number(video?.tags?.rotate ?? video?.side_data_list?.find((item: { rotation?: number }) => item.rotation !== undefined)?.rotation ?? 0), status: 'importing' };
}
