import type { Us } from '../../shared/types';
export const toUs = (seconds: number): Us => Math.round(seconds * 1_000_000);
export const toSeconds = (us: Us): number => us / 1_000_000;
export const toFrame = (us: Us, fps: number): number => Math.round(us * fps / 1_000_000);
export const frameTime = (frame: number, fps: number): Us => Math.round(frame * 1_000_000 / fps);
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function timecode(us: Us, fps = 30): string {
  const frame = Math.max(0, toFrame(us, fps));
  return [Math.floor(frame / fps / 3600), Math.floor(frame / fps / 60) % 60, Math.floor(frame / fps) % 60, frame % fps].map(value => String(value).padStart(2, '0')).join(':');
}
