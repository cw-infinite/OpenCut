import { useEffect } from 'react';
import { MediaResources } from '../engine/resources';
import { renderFrame } from '../engine/compositor';
import { frameTime } from '../engine/time';

export function ExportWorker(): JSX.Element {
  useEffect(() => {
    let resources: MediaResources | undefined;
    const run = async () => {
      const work = await window.opencut.export.work();
      resources = new MediaResources(work.views);
      const canvas = document.createElement('canvas'); canvas.width = work.plan.width; canvas.height = work.plan.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      await document.fonts.ready;
      for (let frame = 0; frame < work.plan.totalFrames; frame++) {
        const time = work.plan.start + frameTime(frame, work.plan.fps);
        await resources.prepare(work.project, time);
        renderFrame(ctx, work.project, time, resources);
        const bytes = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        await window.opencut.export.frame(frame, bytes.buffer as ArrayBuffer);
      }
      await window.opencut.export.finish();
    };
    void run().catch(error => window.opencut.export.workerError(String(error)).catch(() => {})).finally(() => resources?.dispose());
  }, []);
  return <div>Rendering your video locally…</div>;
}
