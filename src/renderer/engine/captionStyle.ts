import type { TextClip } from '../../shared/types';
import { defaultTextStyle, textStyles } from './text';

export const captionPresets = { Karaoke: 'karaoke', 'Word pop': 'wordPop', 'Box highlight': 'box', 'Outline bold': 'outline' } as const;
export function styleCaption(clip: TextClip, name: string, y: number): void {
  const preset = (captionPresets as Partial<Record<string, NonNullable<TextClip['caption']>['preset']>>)[name] ?? 'plain';
  clip.style = { ...defaultTextStyle, ...(textStyles[name] ?? textStyles.Subtitle) };
  clip.transform.y = { value: y, keyframes: [] };
  if (clip.caption) clip.caption.preset = preset;
  if (preset !== 'plain') { delete clip.animIn; delete clip.animOut; delete clip.animLoop; }
  if (preset === 'outline') { clip.style.fontFamily = 'Montserrat'; clip.style.weight = 900; clip.style.fontSize = 68; clip.style.stroke = { color: '#000000', width: 6 }; }
}
export function captionWordState(clip: TextClip, index: number, local: number) {
  const word = clip.caption?.words[index], preset = clip.caption?.preset;
  const active = Boolean(word && local >= word.start && local < word.end);
  const pop = preset === 'wordPop' && word;
  const progress = pop ? Math.max(0, Math.min(1, (local - word.start) / Math.min(140000, word.end - word.start))) : 1;
  return { active, visible: !pop || local >= word.start, scale: pop ? .7 + .3 * progress + .15 * Math.sin(progress * Math.PI) : preset === 'karaoke' && active ? 1.12 : 1 };
}
