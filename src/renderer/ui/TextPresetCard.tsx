import { useEffect, useRef, useState } from 'react';
import { makeTextClip, fontString } from '../engine/text';
import { drawText } from '../engine/textRenderer';
import { applyDesignedTextPreset, designedTextPresets } from '../engine/designedTextPresets';

export function TextPresetCard({ preset, apply }: { preset: typeof designedTextPresets[number]; apply(): void }): JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null), [active, setActive] = useState(false);
  useEffect(() => {
    const clip = makeTextClip('preview', 'preview', 0); clip.content = preset.sample; clip.duration = 3e6;
    applyDesignedTextPreset(clip, preset);
    let canceled = false, frame = 0;
    const context = canvas.current!.getContext('2d')!;
    void document.fonts.load(fontString(clip.style, 1), clip.content).then(() => {
      const start = performance.now();
      const tick = () => {
        if (canceled) return;
        const time = active ? ((performance.now() - start) % 3400) * 1000 : 1500000;
        context.clearRect(0, 0, 480, 270); drawText(context, clip, Math.min(time, clip.duration));
        if (active) frame = requestAnimationFrame(tick);
      }; tick();
    }).catch(() => {});
    return () => { canceled = true; cancelAnimationFrame(frame); };
  }, [active, preset]);
  return <button className="text-preset-card" onPointerEnter={() => setActive(true)} onPointerLeave={() => setActive(false)} onFocus={() => setActive(true)} onBlur={() => setActive(false)} onClick={apply} aria-label={`Apply ${preset.name}`}><canvas aria-hidden="true" ref={canvas} width={480} height={270}/><strong>{preset.name}</strong><small>{preset.purpose}</small><span>{preset.description}</span></button>;
}
