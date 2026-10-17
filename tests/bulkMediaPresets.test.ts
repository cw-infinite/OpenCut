import { afterEach, expect, it, vi } from 'vitest';
import { createProject } from '../src/shared/project';
import { makeMediaClip, makeTrack } from '../src/renderer/engine/timeline';
import { editMediaSelection } from '../src/renderer/engine/bulkMedia';
import { useEditor } from '../src/renderer/state/editor';
import { defaultTextStyle } from '../src/renderer/engine/text';
import { readTextPresets, useTextPresets } from '../src/renderer/state/textPresets';

function fixture() {
  const project = createProject('p', 'Project', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
  const media = { id: 'm', kind: 'image' as const, duration: 5e6, path: 'C:/image.png', status: 'ready' as const, hasAudio: false };
  project.media.m = media;
  const track = makeTrack('t', 'video', 'Video');
  track.clips = [0, 1, 2].map(i => makeMediaClip('c' + i, media, track.id, i * 5e6));
  project.tracks.push(track);
  return project;
}
afterEach(() => vi.unstubAllGlobals());
it('edits selected media atomically, preserves other effects and supports undo', () => {
  useEditor.getState().load(fixture());
  const before = useEditor.getState().project;
  useEditor.getState().edit(project => editMediaSelection(project, ['c0', 'c1'], clip => { clip.adjust.brightness = .5; clip.effects.push({ type: 'blur', enabled: true, params: { amount: .3 } }); }));
  const clips = useEditor.getState().project!.tracks[0].clips;
  expect(clips.map(c => c.type === 'media' && c.adjust.brightness)).toEqual([.5, .5, 0]);
  expect(useEditor.getState().history).toHaveLength(1);
  useEditor.getState().undo();
  expect(useEditor.getState().project).toEqual(before);
  useEditor.getState().edit(project => { project.tracks[0].locked = true; });
  const locked = useEditor.getState().project;
  useEditor.getState().edit(project => editMediaSelection(project, ['c0', 'c1'], clip => { clip.adjust.brightness = .8; }));
  expect(useEditor.getState().project).toBe(locked);
  expect(useEditor.getState().error).toContain('locked');
});
it('persists presets in native application data, recovers unopened project presets, and serializes saves', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { ProjectStore } = await import('../src/main/services/projectStore');
  const { TextPresetStore } = await import('../src/main/services/textPresetStore');
  const root = await mkdtemp(join(tmpdir(), 'opencut-presets-'));
  try {
    const projects = new ProjectStore(root);
    const old = await projects.create('Old project', { width: 320, height: 180, fps: 30, sampleRate: 48000 });
    await projects.update(old.id, project => { project.captionStyles.Legacy = { ...defaultTextStyle, fontSize: 50 }; });
    const presets = new TextPresetStore(projects);
    await Promise.all([
      presets.merge({ Shared: { ...defaultTextStyle, fontSize: 80 } }, true),
      presets.merge({ Another: defaultTextStyle }, true)
    ]);
    const fresh = new TextPresetStore(projects);
    const saved = await fresh.merge({ Shared: defaultTextStyle });
    expect(saved.Shared.fontSize).toBe(80);
    expect(saved.Legacy.fontSize).toBe(50);
    expect(saved.Another).toEqual(defaultTextStyle);
    await expect(fresh.merge({ Invalid: { ...defaultTextStyle, fontSize: -1 } }, true)).rejects.toThrow();
    expect((await fresh.merge({})).Shared.fontSize).toBe(80);
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('saving one preset does not overwrite other native presets with stale browser copies', async () => {
  const merge = vi.fn().mockResolvedValue({});
  vi.stubGlobal('window', { opencut: { textPresets: { merge } } });
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ Other: defaultTextStyle }) });
  await useTextPresets.getState().merge({ New: defaultTextStyle }, true);
  expect(merge).toHaveBeenCalledWith({ New: defaultTextStyle }, true);
});
