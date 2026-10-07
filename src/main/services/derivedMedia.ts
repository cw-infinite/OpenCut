import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MediaAsset, MediaClip } from '../../shared/types';
import { ffmpegJob, prepareMedia } from './ffmpeg';
import { probe } from './mediaProbe';

export async function deriveMedia(asset: MediaAsset, clip: MediaClip, operation: 'freeze' | 'reverse', time: number, id: string, folder: string, fps: number, progress: (stage: string, percent: number) => void): Promise<MediaAsset> {
  const derived = join(folder, 'derived'); await mkdir(derived, { recursive: true });
  if (operation === 'freeze') {
    if (asset.kind !== 'video' || !Number.isSafeInteger(time) || time < clip.start || time >= clip.start + clip.duration) throw new Error('Place the playhead inside a video clip');
    const offset = (time - clip.start) * clip.speed;
    const source = Math.max(clip.sourceIn, Math.min(clip.sourceOut - 1, clip.reverse ? clip.sourceOut - offset - 1 : clip.sourceIn + offset));
    const output = join(derived, `freeze-${id}.png`);
    await ffmpegJob(['-ss', (Math.floor(source * fps / 1e6) / fps).toFixed(6), '-i', asset.proxyPath ?? asset.path, '-frames:v', '1', output], 1, percent => progress('Capturing freeze frame', percent));
    const image = await probe(output, id); await prepareMedia(image, folder, fps, progress); return image;
  }
  if (asset.kind === 'image') throw new Error('Still images cannot be reversed');
  const span = clip.sourceOut - clip.sourceIn, temporary = await mkdtemp(join(derived, 'reverse-work-'));
  const audioOnly = asset.kind === 'audio', output = join(derived, `reverse-${id}${audioOnly ? '.wav' : '.mp4'}`);
  try {
    const chunks: string[] = [];
    // Bound reverse-filter memory: no invocation buffers more than two seconds of video.
    for (let offset = 0; offset < span; offset += 2e6) {
      const duration = Math.min(2e6, span - offset), name = `part-${chunks.length}${audioOnly ? '.wav' : '.mkv'}`;
      const seek = ((clip.sourceIn + offset) / 1e6).toFixed(6), length = (duration / 1e6).toFixed(6);
      const args = audioOnly ? ['-ss', seek, '-t', length, '-i', asset.path, '-vn', '-af', 'areverse', '-c:a', 'pcm_s16le'] :
        ['-ss', seek, '-t', length, '-i', asset.proxyPath ?? asset.path,
          ...(asset.hasAudio ? ['-ss', seek, '-t', length, '-i', asset.path] : []),
          '-map', '0:v:0', ...(asset.hasAudio ? ['-map', '1:a:0', '-af', 'areverse', '-c:a', 'pcm_s16le'] : ['-an']),
          '-vf', 'reverse,setpts=PTS-STARTPTS', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-g', '1', '-pix_fmt', 'yuv420p'];
      await ffmpegJob([...args, join(temporary, name)], duration, percent => progress('Preparing reverse clip', Math.round((offset + duration * percent / 100) / span * 90)));
      chunks.unshift(`file '${name}'`);
    }
    const manifest = join(temporary, 'concat.txt'); await writeFile(manifest, chunks.join('\n'));
    await ffmpegJob(['-f', 'concat', '-safe', '1', '-i', manifest, '-t', (span / 1e6).toFixed(6),
      ...(audioOnly ? ['-c:a', 'pcm_s16le'] : ['-c:v', 'copy', ...(asset.hasAudio ? ['-c:a', 'aac', '-b:a', '192k'] : ['-an']), '-movflags', '+faststart']), output], span, percent => progress('Finishing reverse clip', 90 + Math.round(percent / 10)));
    const result = await probe(output, id);
    result.duration = span;
    await prepareMedia(result, folder, fps, progress); return result;
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
