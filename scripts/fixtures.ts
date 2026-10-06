import { mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ffmpegPath } from '../src/main/services/tools';
import { runProcess } from '../src/main/services/process';

export async function fixtures(): Promise<{ video: string; audio: string; image: string }> {
  const root = resolve('.test-data/fixtures');
  await mkdir(root, { recursive: true });
  const video = join(root, 'variable-frame-rate.mp4');
  const audio = join(root, 'music.mp3');
  const image = join(root, 'transparent.png');
  await runProcess(ffmpegPath, ['-hide_banner', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30:duration=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-vf', "select='if(lt(t,1),not(mod(n,2)),1)'", '-fps_mode', 'vfr', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', video], 60000);
  await runProcess(ffmpegPath, ['-hide_banner', '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=2', '-c:a', 'libmp3lame', audio]);
  await runProcess(ffmpegPath, ['-hide_banner', '-y', '-f', 'lavfi', '-i', 'color=c=red@0.5:size=128x128,format=rgba', '-frames:v', '1', image]);
  return { video, audio, image };
}
