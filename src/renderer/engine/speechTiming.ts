import type { CaptionWord } from '../../shared/captions';
export interface Silence { start: number; end: number }

/** Only tighten boundaries inside measured quiet gaps; never move speech content itself. */
export function refineSpeechTiming(words: CaptionWord[], gaps: Silence[]): CaptionWord[] {
  let cursor = 0;
  return words.map(word => {
    const result = { ...word };
    while (cursor < gaps.length && gaps[cursor].end <= word.start) cursor++;
    for (let i = cursor; i < gaps.length && gaps[i].start < word.end; i++) {
      const gap = gaps[i];
      if (word.start >= gap.start && word.start < gap.end && word.end > gap.end) result.start = gap.end;
      if (word.end > gap.start && word.end <= gap.end && word.start < gap.start) result.end = gap.start;
    }
    return result.end > result.start ? result : word;
  });
}
export function silenceCollector() {
  let buffer = '', start: number | undefined;
  const gaps: Silence[] = [];
  const push = (text: string) => {
    buffer += text; const lines = buffer.split(/[\r\n]/); buffer = lines.pop()!.slice(-4000);
    for (const line of lines) for (const match of line.matchAll(/silence_(start|end):\s*([\d.]+)/g)) {
      const time = Math.round(Number(match[2]) * 1e6);
      if (match[1] === 'start') start = time;
      else if (start !== undefined && time > start) { gaps.push({ start, end: time }); start = undefined; }
    }
  };
  return { gaps, push };
}
