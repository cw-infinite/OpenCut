import type { CaptionCue, CaptionWord } from '../../shared/captions';
import { makeTextClip } from './text';

export function whisperWords(input: unknown, offset = 0, duration = Infinity): CaptionWord[] {
  const segments = (input as { transcription?: unknown[] })?.transcription;
  if (!Array.isArray(segments)) throw new Error('Whisper returned no transcript');
  const words: CaptionWord[] = [];
  const centers: ({ first: number; last: number } | undefined)[] = [];
  for (const item of segments) {
    const segment = item as { text?: string; offsets?: { from: number; to: number }; tokens?: { text: string; t_dtw?: number }[] };
    const tokens = segment.text?.trim().split(/\s+/).filter(Boolean) ?? [];
    const from = segment.offsets?.from, to = segment.offsets?.to;
    if (!tokens.length || !Number.isFinite(from) || !Number.isFinite(to) || to! <= from!) continue;
    for (let i = 0; i < tokens.length; i++) {
      const start = Math.max(0, Math.round((from! + (to! - from!) * i / tokens.length) * 1000));
      const end = Math.min(duration, Math.round((from! + (to! - from!) * (i + 1) / tokens.length) * 1000));
      if (end > start) {
        words.push({ text: tokens[i], start: start + offset, end: end + offset });
        const aligned = tokens.length === 1 ? segment.tokens?.filter(token => !token.text.startsWith('[_') && /[\p{L}\p{N}]/u.test(token.text) && Number.isSafeInteger(token.t_dtw) && token.t_dtw! >= 0) : undefined;
        centers.push(aligned?.length ? { first: aligned[0].t_dtw! * 10000 + offset, last: aligned.at(-1)!.t_dtw! * 10000 + offset } : undefined);
      }
    }
  }
  for (let i = 0; i < words.length; i++) {
    const center = centers[i], previous = centers[i - 1], next = centers[i + 1];
    if (!center) continue;
    const from = previous && previous.last <= center.first ? Math.round((previous.last + center.first) / 2) : words[i].start;
    const to = next && next.first >= center.last ? Math.round((center.last + next.first) / 2) : words[i].end;
    if (to > from) { words[i].start = Math.max(offset, from); words[i].end = Math.min(offset + duration, to); }
  }
  return words.filter(word => word.end > word.start).sort((a, b) => a.start - b.start);
}
function wrap(words: CaptionWord[], width: number): string {
  const lines = [''];
  for (const word of words) {
    if (lines.at(-1) && lines.at(-1)!.length + word.text.length + 1 > width) lines.push('');
    lines[lines.length - 1] += (lines.at(-1) ? ' ' : '') + word.text;
  }
  return lines.join('\n');
}
export function chunkWords(words: CaptionWord[], maxChars = 32, maxWords = 6, maxLines = 2): CaptionCue[] {
  if (!Number.isInteger(maxLines) || maxLines < 1 || maxLines > 4) throw new Error('Choose one to four caption lines');
  if (!Number.isInteger(maxChars) || maxChars < 8 || maxChars > 80 || !Number.isInteger(maxWords) || maxWords < 1 || maxWords > 20) throw new Error('Invalid caption limits');
  const groups: CaptionWord[][] = [];
  let group: CaptionWord[] = [];
  for (const word of words) {
    if (group.length && (group.length >= maxWords || word.end - group[0].start > 5e6 || wrap([...group, word], maxChars).split('\n').length > maxLines || word.start - group.at(-1)!.end > 8e5)) { groups.push(group); group = []; }
    group.push(word);
    if (/[.!?]$/.test(word.text)) { groups.push(group); group = []; }
  }
  if (group.length) groups.push(group);
  return groups.map((words, i) => {
    const start = words[0].start, next = groups[i + 1]?.[0].start ?? Infinity;
    let end = Math.min(next, Math.max(words.at(-1)!.end, start + 400000));
    if (next - end < 80000) end = next;
    return { start, end, text: wrap(words, maxChars), words };
  }).filter(cue => cue.end > cue.start);
}
export function parseSrt(raw: string): CaptionCue[] {
  const time = (value: string): number => {
    const match = /^(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})$/.exec(value);
    if (!match) throw new Error('Invalid SRT timestamp');
    return (Number(match[1]) * 3600000 + Number(match[2]) * 60000 + Number(match[3]) * 1000 + Number(match[4])) * 1000;
  };
  const cues = raw.replace(/^\uFEFF/, '').replace(/\r/g, '').trim().split(/\n\s*\n/).filter(Boolean).map(block => {
    const lines = block.split('\n'); if (/^\d+$/.test(lines[0].trim())) lines.shift();
    const stamps = lines.shift()?.trim().split(/\s+-->\s+/);
    if (!stamps || stamps.length !== 2 || !lines.join('\n').trim()) throw new Error('Invalid SRT cue');
    const start = time(stamps[0]), end = time(stamps[1]);
    if (end <= start) throw new Error('SRT cue must have a positive duration');
    return { start, end, text: lines.join('\n'), words: [] };
  }).sort((a, b) => a.start - b.start);
  if (cues.some((cue, i) => i > 0 && cue.start < cues[i - 1].end)) throw new Error('Overlapping SRT cues are not supported on one caption track');
  return cues;
}
export function captionClip(cue: CaptionCue, trackId: string, id: string, y = .85) {
  const clip = makeTextClip(id, trackId, cue.start);
  clip.duration = cue.end - cue.start; clip.content = cue.text; clip.transform.y.value = y;
  clip.style.fontSize = 48; clip.style.stroke = { color: '#000000', width: 3 };
  clip.caption = { words: cue.words.map(word => ({ ...word, start: Math.max(0, word.start - cue.start), end: Math.min(clip.duration, word.end - cue.start) })) };
  return clip;
}
