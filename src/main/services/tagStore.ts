import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectStore } from './projectStore';
import { normalizeProjectTags } from '../../shared/projectTags';

export class TagStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private projects: ProjectStore) {}
  async list(): Promise<string[]> {
    const saved: string[] = await readFile(join(this.projects.root, 'tags.json'), 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    const tags = new Map<string, string>();
    for (const tag of [...saved, ...(await this.projects.list()).flatMap(project => project.tags ?? [])]) tags.set(tag.toLowerCase(), tag);
    return [...tags.values()].sort((a, b) => a.localeCompare(b));
  }
  change(action: 'create' | 'rename' | 'delete', name: string, replacement?: string): Promise<string[]> {
    const work = this.queue.catch(() => {}).then(async () => {
      const tag = normalizeProjectTags([name])[0];
      if (!tag) throw new Error('Enter a tag name.');
      const next = action === 'rename' ? normalizeProjectTags([replacement])[0] : tag;
      if (!next) throw new Error('Enter a tag name.');
      let tags = await this.list();
      if (action !== 'create') {
        for (const project of await this.projects.list()) {
          if (!project.tags?.some(value => value.toLowerCase() === tag.toLowerCase())) continue;
          await this.projects.update(project.id, current => {
            current.tags = normalizeProjectTags((current.tags ?? []).flatMap(value => value.toLowerCase() === tag.toLowerCase() ? action === 'delete' ? [] : [next] : [value]));
          });
        }
        tags = tags.filter(value => value.toLowerCase() !== tag.toLowerCase());
      }
      if (action !== 'delete' && !tags.some(value => value.toLowerCase() === next.toLowerCase())) tags.push(next);
      await mkdir(this.projects.root, { recursive: true });
      const file = join(this.projects.root, 'tags.json');
      await writeFile(file + '.tmp', JSON.stringify(tags), { flush: true });
      await rename(file + '.tmp', file);
      return this.list();
    });
    this.queue = work;
    return work;
  }
}
