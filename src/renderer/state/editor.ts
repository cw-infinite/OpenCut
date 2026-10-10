import { create } from 'zustand';
import { enablePatches, produceWithPatches, applyPatches, type Patch } from 'immer';
import type { Project, Clip, Track } from '../../shared/types';
import { deleteClips, durationOf, findClip, makeMediaClip, makeTrack, splitClip, validateTimeline } from '../engine/timeline';
import { makeTextClip } from '../engine/text';
import { duplicateSelection } from '../engine/selection';
enablePatches();
interface History { undo: Patch[]; redo: Patch[] }
interface EditorState {
  dragItem: { kind: 'media'; id: string } | { kind: 'text' } | null;
  dragPreview: Project | null;
  project: Project | null; selected: string[]; playhead: number; playing: boolean; zoom: number; snap: boolean;
  history: History[]; future: History[]; clipboard: Clip[]; error: string | null; dirty: boolean;
  load(project: Project): void;
  edit(recipe: (project: Project) => void): void;
  undo(): void; redo(): void; select(ids: string[]): void; seek(time: number): void; play(): void;
  addTrack(kind: Track['kind']): void; addMedia(mediaId: string, trackId?: string, time?: number, index?: number): void;
  addText(trackId?: string, time?: number, index?: number): void;
  split(): void; remove(ripple?: boolean): void; copy(): void; paste(): void; duplicate(): void;
}
export const useEditor = create<EditorState>((set, get) => ({
  dragItem: null,
  dragPreview: null,
  project: null, selected: [], playhead: 0, playing: false, zoom: 80, snap: true, history: [], future: [], clipboard: [], error: null, dirty: false,
  load: project => set({ project, dragItem: null, dragPreview: null, selected: [], playhead: 0, playing: false, history: [], future: [], dirty: false }),
  edit: recipe => {
    const { project, history } = get(); if (!project) return;
    try {
      const [next, redo, undo] = produceWithPatches(project, draft => { recipe(draft); validateTimeline(draft); });
      if (redo.length) set({ project: next, history: [...history.slice(-199), { undo, redo }], future: [], error: null, dirty: true });
    } catch (error) { set({ error: String(error) }); }
  },
  undo: () => { const state = get(), action = state.history.at(-1); if (action && state.project) set({ project: applyPatches(state.project, action.undo), history: state.history.slice(0, -1), future: [...state.future, action], dirty: true, selected: [] }); },
  redo: () => { const state = get(), action = state.future.at(-1); if (action && state.project) set({ project: applyPatches(state.project, action.redo), future: state.future.slice(0, -1), history: [...state.history, action], dirty: true, selected: [] }); },
  select: selected => set({ selected }),
  seek: time => set({ playhead: Math.max(0, Math.round(time)) }),
  play: () => set(state => ({ playing: !state.playing, playhead: state.project && state.playhead >= durationOf(state.project) ? 0 : state.playhead })),
  addTrack: kind => get().edit(project => { project.tracks.push(makeTrack(crypto.randomUUID(), kind, `${kind[0].toUpperCase() + kind.slice(1)} ${project.tracks.filter(track => track.kind === kind).length + 1}`)); }),
  addText: (trackId, time, index) => {
    const id = crypto.randomUUID(), before = get().project;
    get().edit(project => {
      let track = project.tracks.find(track => track.id === trackId);
      if (!track) { track = makeTrack(crypto.randomUUID(), 'text', 'Text'); project.tracks.splice(index ?? project.tracks.length, 0, track); }
      if (track.locked) throw new Error('Track is locked');
      track.clips.push(makeTextClip(id, track.id, Math.round(time ?? get().playhead))); track.clips.sort((a, b) => a.start - b.start);
    }); if (get().project !== before) get().select([id]);
  },
  addMedia: (mediaId, trackId, time, index) => {
    const id = crypto.randomUUID(), before = get().project;
    get().edit(project => {
      const media = project.media[mediaId]; if (!media) throw new Error('Media is missing');
      const kind = media.kind === 'audio' ? 'audio' : 'video';
      let track = project.tracks.find(track => track.id === trackId);
      if (!track) { track = makeTrack(crypto.randomUUID(), kind, `${kind === 'audio' ? 'Audio' : 'Video'} ${project.tracks.length + 1}`); project.tracks.splice(index ?? project.tracks.length, 0, track); }
      if (track.locked) throw new Error('Track is locked');
      track.clips.push(makeMediaClip(id, media, track.id, time ?? get().playhead)); track.clips.sort((a, b) => a.start - b.start);
    }); if (get().project !== before) get().select([id]);
  },
  split: () => get().edit(project => {
    const selected = get().selected;
    const links = project.tracks.flatMap(track => track.clips.filter(clip => selected.includes(clip.id) && clip.linkId).map(clip => clip.linkId));
    const ids = project.tracks.flatMap(track => track.locked && !selected.length ? [] : track.clips.filter(clip => !selected.length || selected.includes(clip.id) || (clip.linkId && links.includes(clip.linkId))).map(clip => clip.id));
    const splitLinks = new Map<string, string>();
    for (const id of ids) {
      const link = findClip(project, id).clip.linkId;
      if (link && !splitLinks.has(link)) splitLinks.set(link, crypto.randomUUID());
      splitClip(project, id, get().playhead, crypto.randomUUID(), link ? splitLinks.get(link) : undefined);
    }
  }),
  remove: ripple => { const before = get().project; get().edit(project => deleteClips(project, get().selected, ripple, false)); if (before !== get().project) get().select([]); },
  copy: () => { const state = get(); set({ clipboard: JSON.parse(JSON.stringify(state.project?.tracks.flatMap(track => track.clips.filter(clip => state.selected.includes(clip.id))) ?? [])) }); },
  paste: () => {
    const state = get(); if (!state.clipboard.length) return;
    const first = Math.min(...state.clipboard.map(clip => clip.start));
    const ids: string[] = [];
    const copiedLinks = new Map<string, string>();
    get().edit(project => { for (const original of state.clipboard) {
      const track = project.tracks.find(track => track.id === original.trackId); if (!track || track.locked) throw new Error('Choose an unlocked destination track');
      const clip: Clip = JSON.parse(JSON.stringify(original)); clip.id = crypto.randomUUID(); clip.start = state.playhead + clip.start - first;
      if (clip.linkId) { if (!copiedLinks.has(clip.linkId)) copiedLinks.set(clip.linkId, crypto.randomUUID()); clip.linkId = copiedLinks.get(clip.linkId); }
      ids.push(clip.id); track.clips.push(clip); track.clips.sort((a, b) => a.start - b.start);
    } }); get().select(ids);
  },
  duplicate: () => { let ids: string[] = []; const before = get().project; get().edit(project => { ids = duplicateSelection(project, get().selected, () => crypto.randomUUID()); }); if (before !== get().project) { get().select(ids); get().seek(Math.min(...get().project!.tracks.flatMap(track => track.clips.filter(clip => ids.includes(clip.id)).map(clip => clip.start)))); } }
}));
