import { runProcess } from './process';
import { ffmpegPath } from './tools';
import { qualityArgs } from '../../renderer/engine/ffmpegArgs';
import type { Encoder, ExportPlan } from '../../shared/export';

export async function selectEncoder(plan: ExportPlan, canceled: () => boolean): Promise<Encoder> {
  if (plan.encoderPreference === 'software') return 'libx264';
  for (const encoder of ['h264_nvenc', 'h264_qsv', 'h264_amf'] as const) {
    if (canceled()) throw new Error('Export canceled');
    try {
      await runProcess(ffmpegPath, ['-v', 'error', '-f', 'lavfi', '-i', `color=black:s=${plan.width}x${plan.height}:r=${plan.fps}`, '-frames:v', '2', '-c:v', encoder,
        ...qualityArgs(encoder, plan.quality, plan.bitrateMbps), '-pix_fmt', 'yuv420p', '-f', 'null', '-'], 15000);
      return encoder;
    } catch { /* Unsupported GPU/driver/settings: try the next encoder, then CPU. */ }
  }
  return 'libx264';
}
