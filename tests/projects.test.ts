import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStore } from '../src/main/services/projectStore';

const folders: string[] = [];
const settings = { width: 1920, height: 1080, fps: 30, sampleRate: 48000 as const };
async function store() { const folder = await mkdtemp(join(tmpdir(), 'opencut-project-test-')); folders.push(folder); return new ProjectStore(folder); }
afterEach(async () => { await Promise.all(folders.splice(0).map(folder => rm(folder, { recursive: true, force: true }))); });
describe('local project persistence', () => {
  it('creates, reopens, renames, duplicates and deletes projects independently', async () => {
    const db = await store();
    const project = await db.create('First edit', settings);
    await db.update(project.id, value => { value.name = 'Renamed'; });
    const duplicate = await db.duplicate(project.id);
    expect(duplicate.id).not.toBe(project.id);
    expect((await db.list()).map(item => item.name).sort()).toEqual(['Renamed', 'Renamed copy']);
    await db.remove(duplicate.id);
    expect((await new ProjectStore(db.root).read(project.id)).project.name).toBe('Renamed');
    expect(await db.list()).toHaveLength(1);
  });
  it('serializes concurrent writes so both updates survive', async () => {
    const db = await store(), project = await db.create('Concurrent', settings);
    await Promise.all([
      db.update(project.id, value => { value.name = 'Updated'; }),
      db.update(project.id, value => { value.markers.push({ id: 'marker', time: 1000000, label: 'Beat' }); })
    ]);
    const saved = (await db.read(project.id)).project;
    expect(saved.name).toBe('Updated'); expect(saved.markers).toHaveLength(1);
  });
  it('recovers a corrupt primary from the prior valid atomic save', async () => {
    const db = await store(), project = await db.create('Before', settings);
    await db.update(project.id, value => { value.name = 'After'; });
    await writeFile(join(db.folder(project.id), 'project.json'), '{interrupted');
    const saved = await db.read(project.id);
    expect(saved.recovered).toBe(true); expect(saved.project.name).toBe('Before');
    await db.update(project.id, value => { value.name = 'Recovered'; });
    expect((await db.read(project.id)).recovered).toBe(false);
  });
  it('rejects path traversal and unsupported canvas settings', async () => {
    const db = await store();
    expect(() => db.folder('../../outside')).toThrow('Invalid project');
    await expect(db.create('Too large', { ...settings, width: 3840 })).rejects.toThrow();
    await expect(db.create('Odd', { ...settings, width: 1919 })).rejects.toThrow();
    await expect(db.create('', settings)).rejects.toThrow();
  });
});
