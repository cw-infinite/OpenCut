import type { MediaClip } from '../../shared/types';
import { effectAmount, processPixels } from './visualEffects';

const pool = new WeakMap<CanvasRenderingContext2D, CanvasRenderingContext2D[]>();
export function visualSurface(owner: CanvasRenderingContext2D, source: CanvasImageSource, clip: MediaClip, crop: { x: number; y: number; width: number; height: number }, width: number, height: number, local: number): HTMLCanvasElement {
  const ratio = Math.min(1, 1920 / Math.max(width, height));
  width = Math.max(1, Math.round(width * ratio)); height = Math.max(1, Math.round(height * ratio));
  let buffers = pool.get(owner);
  if (!buffers) { buffers = Array.from({ length: 2 }, () => document.createElement('canvas').getContext('2d', { willReadFrequently: true })!); pool.set(owner, buffers); }
  const [main, temp] = buffers;
  for (const ctx of buffers) { if (ctx.canvas.width !== width || ctx.canvas.height !== height) { ctx.canvas.width = width; ctx.canvas.height = height; } ctx.resetTransform(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.clearRect(0, 0, width, height); }
  main.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  const pixel = effectAmount(clip, 'pixelate');
  if (pixel) {
    const factor = Math.max(2, Math.round(pixel * 70 * width / 1920)), w = Math.max(1, Math.round(width / factor)), h = Math.max(1, Math.round(height / factor));
    temp.drawImage(main.canvas, 0, 0, width, height, 0, 0, w, h); main.clearRect(0, 0, width, height); main.imageSmoothingEnabled = false;
    main.drawImage(temp.canvas, 0, 0, w, h, 0, 0, width, height); main.imageSmoothingEnabled = true; temp.clearRect(0, 0, width, height);
  }
  if (effectAmount(clip, 'mirror')) {
    temp.drawImage(main.canvas, 0, 0); main.save(); main.translate(width, 0); main.scale(-1, 1); main.drawImage(temp.canvas, 0, 0, width / 2, height, 0, 0, width / 2, height); main.restore(); temp.clearRect(0, 0, width, height);
  }
  const blur = effectAmount(clip, 'blur');
  if (blur) { temp.filter = `blur(${blur * 30 * height / 1080}px)`; temp.drawImage(main.canvas, 0, 0); main.clearRect(0, 0, width, height); main.drawImage(temp.canvas, 0, 0); temp.filter = 'none'; }
  if (clip.mask || clip.chromaKey || clip.filter?.intensity || Object.values(clip.adjust).some(Boolean) || ['rgbSplit', 'vhs', 'grain'].some(name => effectAmount(clip, name))) {
    const pixels = main.getImageData(0, 0, width, height); processPixels(pixels.data, width, height, clip, local); main.putImageData(pixels, 0, 0);
  }
  if (clip.frame) {
    const scale = height / 1080, radius = Math.min(width / 2, height / 2, clip.frame.radius * scale), border = clip.frame.borderWidth * scale;
    temp.clearRect(0, 0, width, height); temp.fillStyle = '#ffffff'; temp.beginPath(); temp.roundRect(0, 0, width, height, radius); temp.fill();
    main.globalCompositeOperation = 'destination-in'; main.drawImage(temp.canvas, 0, 0); main.globalCompositeOperation = 'source-over';
    if (border) { main.strokeStyle = clip.frame.borderColor; main.lineWidth = border; main.beginPath(); main.roundRect(border / 2, border / 2, Math.max(0, width - border), Math.max(0, height - border), Math.max(0, radius - border / 2)); main.stroke(); }
  }
  return main.canvas;
}
