import type { TextAnimation, TextClip } from '../../shared/types';
import { evaluate } from './keyframes';
import { animationAt } from './textAnimations';
import { fontString } from './text';
import { constant } from './timeline';
import { captionWordState } from './captionStyle';

interface Glyph { char: string; x: number; y: number; width: number; line: number; word: number; index: number }
const layouts = new WeakMap<TextClip, Map<string, { glyphs: Glyph[]; width: number; height: number }>>();
function layout(ctx: CanvasRenderingContext2D, clip: TextClip, scale: number): { glyphs: Glyph[]; width: number; height: number } {
  const key = `${ctx.canvas.width}:${ctx.canvas.height}`;
  const cache = layouts.get(clip) ?? new Map(); layouts.set(clip, cache);
  const cached = cache.get(key); if (cached) return cached;
  const style = clip.style, spacing = style.letterSpacing * scale, max = ctx.canvas.width * style.maxWidthFraction;
  const measure = (text: string) => Array.from(text).reduce((sum, char) => sum + ctx.measureText(char).width + spacing, 0);
  const lines: { char: string; word: number }[][] = []; let wordIndex = 0;
  for (const paragraph of clip.content.split('\n')) {
    let line: { char: string; word: number }[] = [];
    for (const word of paragraph.split(/(\s+)/)) {
      if (!word) continue;
      if (line.length && measure(line.map(item => item.char).join('') + word) > max) { while (line.at(-1) && !line.at(-1)!.char.trim()) line.pop(); lines.push(line); line = []; }
      for (const char of Array.from(word)) {
        if (line.length && measure(line.map(item => item.char).join('') + char) > max) { lines.push(line); line = []; }
        if (line.length || char.trim()) line.push({ char, word: word.trim() ? wordIndex : Math.max(0, wordIndex - 1) });
      }
      if (word.trim()) wordIndex++;
    }
    lines.push(line);
  }
  const widths = lines.map(line => measure(line.map(item => item.char).join(''))), width = Math.max(0, ...widths), lineHeight = style.fontSize * scale * style.lineHeight;
  const glyphs: Glyph[] = [];
  lines.forEach((line, index) => {
    let x = style.align === 'left' ? -width / 2 : style.align === 'right' ? width / 2 - widths[index] : -widths[index] / 2;
    const y = (index - (lines.length - 1) / 2) * lineHeight;
    for (const { char, word } of line) {
      const size = ctx.measureText(char).width;
      glyphs.push({ char, x, y, width: size, line: index, word, index: glyphs.length });
      x += size + spacing;
    }
  });
  const result = { glyphs, width, height: Math.max(lineHeight, lines.length * lineHeight) }; cache.set(key, result); return result;
}
const titleLayers = new WeakMap<TextClip, Map<string, HTMLCanvasElement>>();
export function drawText(ctx: CanvasRenderingContext2D, clip: TextClip, time: number): void {
  const animations = [clip.animIn, clip.animOut, clip.animLoop];
  if ((clip.caption?.words.length && ['karaoke', 'wordPop', 'box'].includes(clip.caption.preset ?? '')) || animations.some(animation => animation && (animation.granularity !== 'whole' || ['typewriter', 'wipe'].includes(animation.preset)))) {
    drawTextBase(ctx, clip, time); return;
  }
  const key = `${ctx.canvas.width}:${ctx.canvas.height}`, cache = titleLayers.get(clip) ?? new Map<string, HTMLCanvasElement>(); titleLayers.set(clip, cache);
  let layer = cache.get(key);
  if (!layer) {
    layer = document.createElement('canvas'); layer.width = ctx.canvas.width; layer.height = ctx.canvas.height;
    const staticClip: TextClip = { ...clip, animIn: undefined, animOut: undefined, animLoop: undefined, opacity: constant(1), transform: { x: constant(.5), y: constant(.5), scale: constant(1), rotation: constant(0) } };
    drawTextBase(layer.getContext('2d')!, staticClip, clip.start); cache.set(key, layer);
  }
  const local = time - clip.start, s = ctx.canvas.height / 1080;
  ctx.save(); ctx.globalAlpha = evaluate(clip.opacity, local);
  ctx.translate(evaluate(clip.transform.x, local) * ctx.canvas.width, evaluate(clip.transform.y, local) * ctx.canvas.height);
  ctx.rotate(evaluate(clip.transform.rotation, local) * Math.PI / 180); ctx.scale(evaluate(clip.transform.scale, local), evaluate(clip.transform.scale, local));
  let blur = 0, hue = 0;
  for (const [animation, phase] of [[clip.animIn, 'in'], [clip.animOut, 'out'], [clip.animLoop, 'loop']] as const) {
    if (!animation) continue;
    const motion = animationAt(animation, local, clip.duration, 0, 1, phase);
    ctx.translate(motion.dx * s, motion.dy * s); ctx.rotate(motion.rotation * Math.PI / 180); ctx.scale(motion.scale, motion.scale); ctx.globalAlpha *= motion.opacity;
    blur += motion.blur; hue += motion.hue;
  }
  ctx.filter = blur || hue ? `blur(${blur * s}px) hue-rotate(${hue}deg)` : 'none';
  ctx.drawImage(layer, -layer.width / 2, -layer.height / 2); ctx.restore();
}
function drawTextBase(ctx: CanvasRenderingContext2D, clip: TextClip, time: number): void {
  const s = ctx.canvas.height / 1080, local = time - clip.start, style = clip.style;
  ctx.save(); ctx.font = fontString(style, s); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const { glyphs, width, height } = layout(ctx, clip, s);
  ctx.translate(evaluate(clip.transform.x, local) * ctx.canvas.width, evaluate(clip.transform.y, local) * ctx.canvas.height);
  ctx.rotate(evaluate(clip.transform.rotation, local) * Math.PI / 180); ctx.scale(evaluate(clip.transform.scale, local), evaluate(clip.transform.scale, local));
  ctx.globalAlpha = evaluate(clip.opacity, local);
  let baseBlur = 0, baseHue = 0;
  for (const [animation, phase] of [[clip.animIn, 'in'], [clip.animOut, 'out'], [clip.animLoop, 'loop']] as const) {
    if (!animation || animation.granularity !== 'whole') continue;
    const motion = animationAt(animation, local, clip.duration, 0, 1, phase);
    ctx.translate(motion.dx * s, motion.dy * s); ctx.rotate(motion.rotation * Math.PI / 180); ctx.scale(motion.scale, motion.scale);
    ctx.globalAlpha *= motion.opacity; baseBlur += motion.blur; baseHue += motion.hue;
  }
  ctx.filter = baseBlur || baseHue ? `blur(${baseBlur * s}px) hue-rotate(${baseHue}deg)` : 'none';
  if (style.background) {
    const b = style.background, padX = b.paddingX * s, padY = b.paddingY * s;
    ctx.save(); ctx.globalAlpha *= b.opacity; ctx.fillStyle = b.color; ctx.beginPath(); ctx.roundRect(-width / 2 - padX, -height / 2 - padY, width + padX * 2, height + padY * 2, b.radius * s); ctx.fill(); ctx.restore();
  }
  let fill: string | CanvasGradient = style.color;
  if (style.gradient) {
    const angle = style.gradient.angle * Math.PI / 180, dx = Math.cos(angle) * width / 2, dy = Math.sin(angle) * height / 2;
    const gradient = ctx.createLinearGradient(-dx, -dy, dx, dy); gradient.addColorStop(0, style.gradient.from); gradient.addColorStop(1, style.gradient.to); fill = gradient;
  }
  interface Group { index: number; left: number; right: number; top: number; bottom: number; length: number }
  const groupCache = new Map<string, { count: number; byGlyph: Map<number, { group: Group; index: number }> }>();
  const groups = (granularity: TextAnimation['granularity']) => {
    let result = groupCache.get(granularity); if (result) return result;
    const map = new Map<number, Glyph[]>();
    for (const glyph of glyphs) { const id = granularity === 'whole' ? 0 : granularity === 'char' ? glyph.index : glyph[granularity]; const group = map.get(id) ?? []; group.push(glyph); map.set(id, group); }
    const byGlyph = new Map<number, { group: Group; index: number }>();
    [...map.values()].forEach((items, index) => {
      const group = { index, left: Math.min(...items.map(item => item.x)), right: Math.max(...items.map(item => item.x + item.width)), top: Math.min(...items.map(item => item.y)) - style.fontSize * s, bottom: Math.max(...items.map(item => item.y)) + style.fontSize * s, length: items.length };
      items.forEach((item, index) => byGlyph.set(item.index, { group, index }));
    });
    result = { count: map.size, byGlyph }; groupCache.set(granularity, result); return result;
  };
  if (clip.caption?.preset === 'box') {
    const boxes = new Map<string, Glyph[]>();
    for (const glyph of glyphs) if (glyph.char.trim() && captionWordState(clip, glyph.word, local).active) {
      const id = `${glyph.word}:${glyph.line}`, items = boxes.get(id) ?? []; items.push(glyph); boxes.set(id, items);
    }
    ctx.save(); ctx.fillStyle = '#baff72';
    for (const items of boxes.values()) {
      const left = Math.min(...items.map(item => item.x)), right = Math.max(...items.map(item => item.x + item.width));
      ctx.beginPath(); ctx.roundRect(left - 5 * s, items[0].y - style.fontSize * s * .6, right - left + 10 * s, style.fontSize * s * 1.2, 5 * s); ctx.fill();
    }
    ctx.restore();
  }
  for (const glyph of glyphs) {
    ctx.save(); let visible = true, blur = baseBlur, hue = baseHue;
    const caption = captionWordState(clip, glyph.word, local);
    visible = caption.visible;
    if (caption.scale !== 1) {
      const group = groups('word').byGlyph.get(glyph.index)!.group, cx = (group.left + group.right) / 2;
      ctx.translate(cx, glyph.y); ctx.scale(caption.scale, caption.scale); ctx.translate(-cx, -glyph.y);
    }
    for (const [animation, phase] of [[clip.animIn, 'in'], [clip.animOut, 'out'], [clip.animLoop, 'loop']] as const) {
      if (!animation) continue;
      const all = groups(animation.granularity), entry = all.byGlyph.get(glyph.index)!, group = entry.group;
      const motion = animationAt(animation, local, clip.duration, group.index, all.count, phase);
      const { left, right, top, bottom } = group;
      const cx = (left + right) / 2, cy = (top + bottom) / 2;
      if (animation.granularity !== 'whole') {
        ctx.translate(cx + motion.dx * s, cy + motion.dy * s); ctx.rotate(motion.rotation * Math.PI / 180); ctx.scale(motion.scale, motion.scale); ctx.translate(-cx, -cy);
        ctx.globalAlpha *= motion.opacity; blur += motion.blur; hue += motion.hue;
      }
      if (animation.preset === 'typewriter' && entry.index >= Math.ceil(group.length * motion.reveal)) visible = false;
      if (animation.preset === 'wipe') { ctx.beginPath(); ctx.rect(left, top, (right - left) * motion.reveal, bottom - top); ctx.clip(); }
    }
    if (visible) {
      ctx.filter = blur || hue ? `blur(${blur * s}px) hue-rotate(${hue}deg)` : 'none';
      ctx.fillStyle = caption.active && clip.caption?.preset === 'karaoke' ? '#baff72' : caption.active && clip.caption?.preset === 'box' ? '#14171d' : fill;
      if (style.shadow) { ctx.shadowColor = style.shadow.color; ctx.shadowBlur = style.shadow.blur * s; ctx.shadowOffsetX = style.shadow.offsetX * s; ctx.shadowOffsetY = style.shadow.offsetY * s; }
      if (style.glow) { ctx.save(); ctx.shadowColor = style.glow.color; ctx.shadowBlur = style.glow.blur * s; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.fillText(glyph.char, glyph.x, glyph.y); ctx.restore(); }
      if (style.stroke && !(caption.active && clip.caption?.preset === 'box')) { ctx.strokeStyle = style.stroke.color; ctx.lineWidth = style.stroke.width * s; ctx.strokeText(glyph.char, glyph.x, glyph.y); }
      ctx.fillText(glyph.char, glyph.x, glyph.y);
    }
    ctx.restore();
  }
  ctx.restore();
}
