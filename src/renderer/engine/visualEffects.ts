import type { MediaClip } from '../../shared/types';

export const filterPresets = ['Vivid', 'Warm', 'Cool', 'B&W', 'Vintage', 'Cinematic', 'Faded'] as const;
export const visualEffects = { blur: 'Gaussian blur', rgbSplit: 'RGB split', shake: 'Shake', zoomPulse: 'Zoom pulse', vhs: 'VHS', mirror: 'Mirror', pixelate: 'Pixelate', grain: 'Film grain' } as const;
export const effectAmount = (clip: MediaClip, type: string) => Number(clip.effects.find(effect => effect.type === type && effect.enabled)?.params.amount ?? 0);
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smooth = (a: number, b: number, value: number) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
const noise = (value: number) => { let n = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return (n >>> 0) / 4294967295 - .5; };
export function needsVisualSurface(clip: MediaClip): boolean {
  return Boolean(clip.mask || clip.chromaKey || clip.frame || clip.filter?.intensity || Object.values(clip.adjust).some(Boolean) || clip.effects.some(effect => effect.enabled && effect.type in visualEffects && !['shake', 'zoomPulse'].includes(effect.type)));
}
export function effectMotion(clip: MediaClip, local: number) {
  const shake = effectAmount(clip, 'shake'), pulse = effectAmount(clip, 'zoomPulse'), t = local / 1e6;
  return { x: shake * 18 * Math.sin(t * 47), y: shake * 12 * Math.sin(t * 61 + 1), scale: 1 + pulse * .15 * (.5 + .5 * Math.sin(t * Math.PI * 3)) };
}
export function maskAlpha(mask: NonNullable<MediaClip['mask']>, x: number, y: number): number {
  return maskSampler(mask)(x, y);
}
function maskSampler(mask: NonNullable<MediaClip['mask']>) {
  const angle = -mask.rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  return (x: number, y: number) => {
  const dx = x - mask.x, dy = y - mask.y, rx = dx * cos - dy * sin, ry = dx * sin + dy * cos;
  let alpha: number;
  if (mask.shape === 'linear') alpha = mask.feather ? 1 - smooth(-mask.feather / 2, mask.feather / 2, rx) : Number(rx <= 0);
  else {
    const nx = Math.abs(rx) / (mask.width / 2), ny = Math.abs(ry) / (mask.height / 2);
    const distance = mask.shape === 'ellipse' ? Math.hypot(nx, ny) : Math.max(nx, ny);
    alpha = mask.feather ? 1 - smooth(1 - mask.feather, 1 + mask.feather, distance) : Number(distance <= 1);
  }
  return mask.invert ? 1 - alpha : alpha;
  };
}
/** Same deterministic pixel operations are used by preview and the export worker. */
export function processPixels(data: Uint8ClampedArray, width: number, height: number, clip: MediaClip, local: number): void {
  const intensity = clip.filter?.intensity ?? 0, preset = clip.filter?.preset;
  let { brightness, contrast, saturation, temperature, vignette, sharpen } = clip.adjust;
  if (preset === 'Vivid') { saturation += .35 * intensity; contrast += .15 * intensity; }
  if (preset === 'Warm') temperature += .6 * intensity;
  if (preset === 'Cool') temperature -= .6 * intensity;
  if (preset === 'B&W') saturation -= intensity;
  if (preset === 'Cinematic') { contrast += .25 * intensity; saturation -= .2 * intensity; temperature -= .1 * intensity; }
  if (preset === 'Faded') { contrast -= .3 * intensity; brightness += .12 * intensity; }
  const grain = effectAmount(clip, 'grain'), vhs = effectAmount(clip, 'vhs'), split = effectAmount(clip, 'rgbSplit');
  const shift = Math.max(0, Math.round((split * 18 + vhs * 3) * width / 1920));
  const original = shift ? data.slice() : data;
  const key = clip.chromaKey, keyRgb = key ? [1, 3, 5].map(start => parseInt(key.color.slice(start, start + 2), 16)) : [0, 0, 0];
  const keyChannel = keyRgb.indexOf(Math.max(...keyRgb)), seed = Math.floor(local / 1e6 * 30) * 7919;
  const mask = clip.mask ? maskSampler(clip.mask) : undefined;
  const kcb = -.168736 * keyRgb[0] - .331264 * keyRgb[1] + .5 * keyRgb[2], kcr = .5 * keyRgb[0] - .418688 * keyRgb[1] - .081312 * keyRgb[2];
  const keyMagnitude = Math.hypot(kcb, kcr);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    let r = original[(y * width + Math.min(width - 1, x + shift)) * 4], g = original[index + 1], b = original[(y * width + Math.max(0, x - shift)) * 4 + 2];
    if (key) {
      // Compare chroma direction so darker shades of the key hue also disappear.
      const cb = -.168736 * r - .331264 * g + .5 * b, cr = .5 * r - .418688 * g - .081312 * b;
      const magnitude = Math.hypot(cb, cr);
      const distance = keyMagnitude < 8 ? Math.hypot(r - keyRgb[0], g - keyRgb[1], b - keyRgb[2]) / 441.673 : magnitude < 8 ? 1 : Math.hypot(cb / magnitude - kcb / keyMagnitude, cr / magnitude - kcr / keyMagnitude) / 2;
      const alpha = smooth(key.similarity, key.similarity + Math.max(.001, key.smoothness), distance); data[index + 3] *= alpha;
      const spill = key.spill * (1 - alpha);
      if (keyChannel === 0) r -= Math.max(0, r - Math.max(g, b)) * spill;
      else if (keyChannel === 1) g -= Math.max(0, g - Math.max(r, b)) * spill;
      else b -= Math.max(0, b - Math.max(r, g)) * spill;
    }
    const luma = .2126 * r + .7152 * g + .0722 * b, sat = Math.max(0, 1 + saturation);
    r = luma + (r - luma) * sat; g = luma + (g - luma) * sat; b = luma + (b - luma) * sat;
    r = (r - 128) * (1 + contrast) + 128 + brightness * 80 + temperature * 30;
    g = (g - 128) * (1 + contrast) + 128 + brightness * 80;
    b = (b - 128) * (1 + contrast) + 128 + brightness * 80 - temperature * 30;
    if (preset === 'Vintage') { const rr = .393 * r + .769 * g + .189 * b, gg = .349 * r + .686 * g + .168 * b, bb = .272 * r + .534 * g + .131 * b; r += (rr - r) * intensity * .7; g += (gg - g) * intensity * .7; b += (bb - b) * intensity * .7; }
    const shade = vignette ? 1 - vignette * .8 * clamp((Math.hypot(x / width - .5, y / height - .5) - .15) / .55) ** 2 : 1;
    const random = grain || vhs ? noise(index + seed) * (grain * 55 + vhs * 18) : 0, scan = vhs ? 1 - vhs * .25 * Number(Math.floor(y * 1080 / height) % 4 === 0) : 1;
    data[index] = r * shade * scan + random; data[index + 1] = g * shade * scan + random; data[index + 2] = b * shade * scan + random;
    if (mask) data[index + 3] *= mask((x + .5) / width, (y + .5) / height);
  }
  if (sharpen) {
    const pixels = data.slice(), amount = sharpen * .6;
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) for (let channel = 0; channel < 3; channel++) {
      const index = (y * width + x) * 4 + channel;
      data[index] = pixels[index] * (1 + 4 * amount) - amount * (pixels[index - 4] + pixels[index + 4] + pixels[index - width * 4] + pixels[index + width * 4]);
    }
  }
}
