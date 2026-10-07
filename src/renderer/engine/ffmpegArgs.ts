import { volumeFilter } from './audioAutomation';
import type { Project, MediaClip } from '../../shared/types';
import type { Encoder, ExportPlan, ExportRequest, Quality } from '../../shared/export';
import { durationOf } from './timeline';
import { frameTime } from './time';

export function makeExportPlan(project: Project, request: ExportRequest): ExportPlan {
  if (![480, 720, 1080].includes(request.resolution) || ![24, 25, 30, 50, 60].includes(request.fps) ||
    !['low', 'medium', 'high', 'maximum', 'custom'].includes(request.quality) ||
    ![128, 192, 256, 320].includes(request.audioBitrate) || !['auto', 'software'].includes(request.encoderPreference) ||
    !Number.isFinite(request.bitrateMbps) || request.bitrateMbps < .1 || request.bitrateMbps > 100) throw new Error('Invalid export settings');
  const duration = durationOf(project), start = request.range?.start ?? 0, end = request.range?.end ?? duration;
  if (![start, end].every(Number.isSafeInteger) || start < 0 || end > duration || end <= start) throw new Error('Choose a nonempty range within the timeline');
  const aspect = project.settings.width / project.settings.height;
  const height = aspect >= 1 ? request.resolution : Math.round(request.resolution / aspect / 2) * 2;
  const width = aspect >= 1 ? Math.round(request.resolution * aspect / 2) * 2 : request.resolution;
  if (Math.max(width, height) > 1920 || Math.min(width, height) < 2) throw new Error('This aspect ratio exceeds the 1080p export limits');
  return { ...request, width, height, start, end, totalFrames: Math.ceil((end - start) * request.fps / 1e6) };
}
export function atempoChain(speed: number): string[] {
  if (!Number.isFinite(speed) || speed < .1 || speed > 100) throw new Error('Invalid audio speed');
  const filters: string[] = [];
  while (speed > 2) { filters.push('atempo=2'); speed /= 2; }
  while (speed < .5) { filters.push('atempo=0.5'); speed /= .5; }
  if (speed !== 1 || !filters.length) filters.push(`atempo=${speed}`);
  return filters;
}
const seconds = (time: number) => (time / 1e6).toFixed(6);
export function audioMixArgs(project: Project, plan: Pick<ExportPlan, 'start' | 'end' | 'totalFrames' | 'fps'>, output: string): string[] {
  const args: string[] = [], graph: string[] = [], labels: string[] = [];
  const duration = seconds(frameTime(plan.totalFrames, plan.fps));
  for (const track of project.tracks) {
    if (track.hidden || track.muted) continue;
    for (const candidate of track.clips) {
      if (candidate.type !== 'media' || candidate.muted || !project.media[candidate.mediaId]?.hasAudio) continue;
      const clip: MediaClip = candidate;
      if (clip.start >= plan.end || clip.start + clip.duration <= plan.start) continue;
      const index = labels.length;
      args.push('-ss', seconds(clip.sourceIn), '-t', seconds(clip.sourceOut - clip.sourceIn), '-i', project.media[clip.mediaId].path);
      const filters = ['aresample=48000', 'aformat=sample_fmts=fltp:channel_layouts=stereo', 'asetpts=PTS-STARTPTS'];
      if (clip.reverse) filters.push('areverse');
      filters.push(...atempoChain(clip.speed), volumeFilter(clip.volume));
      const incoming = clip.transitionIn?.duration ?? 0, outgoing = track.clips[track.clips.indexOf(clip) + 1]?.transitionIn?.duration ?? 0;
      if (incoming) filters.push(`afade=t=in:st=0:d=${seconds(incoming)}`);
      if (outgoing) filters.push(`afade=t=out:st=${seconds(clip.duration - outgoing)}:d=${seconds(outgoing)}`);
      if (clip.fadeIn) filters.push(`afade=t=in:st=0:d=${seconds(clip.fadeIn)}`);
      if (clip.fadeOut) filters.push(`afade=t=out:st=${seconds(Math.max(0, clip.duration - clip.fadeOut))}:d=${seconds(clip.fadeOut)}`);
      const from = Math.max(0, plan.start - clip.start), to = Math.min(clip.duration, plan.end - clip.start);
      filters.push(`atrim=start=${seconds(from)}:end=${seconds(to)}`, 'asetpts=PTS-STARTPTS');
      const delay = Math.round(Math.max(0, clip.start - plan.start) * 48000 / 1e6);
      filters.push(`adelay=${delay}S:all=1`);
      graph.push(`[${index}:a:0]${filters.join(',')}[a${index}]`); labels.push(`[a${index}]`);
    }
  }
  if (!labels.length) return ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', duration, '-c:a', 'pcm_s16le', output];
  graph.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=longest,alimiter=limit=0.95:level=false:latency=true,apad,atrim=duration=${duration}[mix]`);
  return [...args, '-filter_complex', graph.join(';'), '-map', '[mix]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', output];
}
export function qualityArgs(encoder: Encoder, quality: Quality, bitrateMbps: number): string[] {
  const q = { low: 28, medium: 23, high: 19, maximum: 15, custom: 23 }[quality];
  if (quality === 'custom') return ['-b:v', `${bitrateMbps}M`, ...(encoder === 'libx264' ? ['-preset', 'medium'] : [])];
  if (encoder === 'h264_nvenc') return ['-preset', 'p4', '-rc', 'vbr', '-cq', String(q), '-b:v', '0'];
  if (encoder === 'h264_qsv') return ['-global_quality', String(q), '-preset', 'medium'];
  if (encoder === 'h264_amf') return ['-quality', 'quality', '-rc', 'cqp', '-qp_i', String(q), '-qp_p', String(q)];
  return ['-preset', 'medium', '-crf', String(q)];
}
export function videoExportArgs(plan: ExportPlan, encoder: Encoder, mix: string, output: string): string[] {
  return ['-hide_banner', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${plan.width}x${plan.height}`, '-r', String(plan.fps), '-i', 'pipe:0',
    '-i', mix, '-map', '0:v:0', '-map', '1:a:0', '-c:v', encoder, ...qualityArgs(encoder, plan.quality, plan.bitrateMbps),
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', `${plan.audioBitrate}k`, '-movflags', '+faststart', '-shortest', output];
}
