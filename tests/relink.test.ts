import { it, expect } from 'vitest';
import { mkdtemp, copyFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStore } from '../src/main/services/projectStore';
import { MediaLibrary } from '../src/main/services/mediaLibrary';
import { fixtures } from '../scripts/fixtures';
import { makeMediaClip, makeTrack } from '../src/renderer/engine/timeline';

it('relinks moved media while preserving clip IDs and rejects incompatible or short replacements', async () => {
  const root = await mkdtemp(join(tmpdir(), 'opencut-relink-'));
  try {
    const paths = await fixtures(join(root, 'fixtures')), store = new ProjectStore(root), library = new MediaLibrary(store);
    const project = await store.create('Relink', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
    const original = join(root, 'original.mp3'), moved = join(root, 'moved.mp3'); await copyFile(paths.audio, original);
    const imported = await library.import(project.id, [original], () => {}), asset = Object.values(imported.media)[0];
    await store.update(project.id, current => { const track = makeTrack('a', 'audio', 'Audio'); track.clips.push(makeMediaClip('clip', asset, track.id, 0)); current.tracks = [track]; });
    await rename(original, moved); expect((await library.views(project.id))[0].missing).toBe(true);
    await expect(library.relink(project.id, asset.id, paths.image, () => {})).rejects.toThrow('same media type');
    const relinked = await library.relink(project.id, asset.id, moved, () => {});
    expect(relinked.tracks[0].clips[0]).toMatchObject({ id: 'clip', mediaId: asset.id });
    expect(relinked.media[asset.id].path).toBe(moved); expect((await library.views(project.id))[0].missing).toBe(false);
    expect(relinked.media[asset.id].proxyPath).not.toBe(asset.proxyPath);
    await store.update(project.id, current => { const clip = current.tracks[0].clips[0]; if (clip.type === 'media') clip.sourceOut += 1e6; });
    await expect(library.relink(project.id, asset.id, moved, () => {})).rejects.toThrow('shorter');
  } finally { await rm(root, { recursive: true, force: true }); }
}, 60000);
