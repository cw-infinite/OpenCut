import { expect, it } from 'vitest';
import { normalizeProjectTags } from '../src/shared/projectTags';
import { ProjectStore } from '../src/main/services/projectStore';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

it('normalizes tags and rejects invalid or excessive input', () => {
  expect(normalizeProjectTags([' Client  Work ', '', 'client work', 'Personal'])).toEqual(['client work', 'Personal']);
  for (const invalid of [null, [1], ['a,b'], ['x'.repeat(41)], Array(21).fill('tag')]) expect(() => normalizeProjectTags(invalid)).toThrow();
});

it('persists tags across reopening, duplication and independent edits while supporting old projects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'opencut-tags-'));
  try {
    const store = new ProjectStore(root);
    const project = await store.create('Tagged project', { width: 1920, height: 1080, fps: 30, sampleRate: 48000 });
    expect((await store.list())[0].tags).toBeUndefined();
    await store.update(project.id, value => { value.tags = normalizeProjectTags(['Work', 'Draft']); });
    const reopened = new ProjectStore(root);
    expect((await reopened.list())[0].tags).toEqual(['Work', 'Draft']);
    const copy = await reopened.duplicate(project.id);
    expect(copy.tags).toEqual(['Work', 'Draft']);
    await reopened.update(copy.id, value => { value.tags = []; });
    expect((await reopened.read(project.id)).project.tags).toEqual(['Work', 'Draft']);
    expect((await reopened.read(copy.id)).project.tags).toEqual([]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
