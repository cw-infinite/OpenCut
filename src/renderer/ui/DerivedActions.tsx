import { useState } from 'react';
import type { MediaClip } from '../../shared/types';
import { useEditor } from '../state/editor';
import { useProjects } from '../state/projects';
import { constant, editable, makeMediaClip, makeTrack } from '../engine/timeline';
import { evaluate } from '../engine/keyframes';

export function DerivedActions({ clip }: { clip: MediaClip }): JSX.Element {
  const state = useEditor(), [busy, setBusy] = useState(false), progress = useProjects(state => state.progress);
  const asset = state.project!.media[clip.mediaId];
  const derive = async (operation: 'reverse' | 'freeze') => {
    const snapshot = useEditor.getState(), project = snapshot.project!;
    setBusy(true); useEditor.setState({ playing: false });
    try {
      if (clip.linkId && operation === 'reverse') throw new Error('Unlink the clip before reversing; its video and embedded audio will reverse together');
      await window.opencut.projects.saveEdit(project);
      const result = await window.opencut.media.derive(project.id, clip.id, operation, snapshot.playhead);
      const current = useEditor.getState(); if (current.project?.id !== project.id) return;
      useEditor.setState({ project: { ...current.project, media: { ...current.project.media, [result.id]: result } } });
      useProjects.setState({ views: await window.opencut.media.views(project.id) });
      current.edit(project => {
        const original = editable(project, clip.id).clip;
        if (original.type !== 'media' || original.mediaId !== clip.mediaId || original.sourceIn !== clip.sourceIn || original.sourceOut !== clip.sourceOut || original.speed !== clip.speed) throw new Error('The clip changed during preparation. The prepared media is available in the library.');
        if (operation === 'reverse') {
          original.mediaId = result.id; original.sourceIn = 0; original.sourceOut = result.duration; original.reverse = false;
        } else {
          const track = makeTrack(crypto.randomUUID(), 'video', 'Freeze frame');
          const frozen = makeMediaClip(crypto.randomUUID(), result, track.id, snapshot.playhead), time = snapshot.playhead - clip.start;
          for (const name of ['x', 'y', 'scale', 'rotation'] as const) frozen.transform[name] = constant(evaluate(clip.transform[name], time));
          frozen.opacity = constant(evaluate(clip.opacity, time)); frozen.crop = { ...clip.crop }; frozen.fit = clip.fit;
          frozen.adjust = { ...clip.adjust }; frozen.effects = structuredClone(clip.effects); frozen.blurBackground = clip.blurBackground;
          track.clips.push(frozen); project.tracks.push(track);
        }
      });
    } catch (error) { useEditor.setState({ error: String(error) }); }
    finally { setBusy(false); }
  };
  return <section><div className="inspector-buttons">
    <button className="secondary" disabled={busy || asset.kind === 'image'} onClick={() => void derive('reverse')}>Reverse clip</button>
    <button className="secondary" disabled={busy || asset.kind !== 'video' || state.playhead < clip.start || state.playhead >= clip.start + clip.duration} onClick={() => void derive('freeze')}>Freeze frame</button>
  </div><p className="subtle">{busy ? `${progress?.stage ?? 'Preparing media'} · ${progress?.percent ?? 0}%` : 'Freeze adds a 5-second still on a new track. Reverse creates local media; Undo restores the clip.'}</p></section>;
}
