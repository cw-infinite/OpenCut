import { mkdir, readFile, writeFile, rename, copyFile, readdir, stat, rm, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createProject, parseProject, validSettings } from '../../shared/project';
import type { Project } from '../../shared/types';
import type { ProjectSummary } from '../../shared/api';

export class ProjectStore {
  private queues = new Map<string, Promise<unknown>>();
  constructor(readonly root: string) {}
  folder(id: string): string {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid project ID');
    return join(this.root, 'projects', id);
  }
  async list(): Promise<ProjectSummary[]> {
    const folders = await readdir(join(this.root, 'projects'), { withFileTypes: true }).catch(() => []);
    const entries = await Promise.all(folders.filter(folder => folder.isDirectory()).map(async folder => {
      try {
        const { project } = await this.read(folder.name);
        const file = await stat(join(this.folder(project.id), 'project.json')).catch(() => stat(join(this.folder(project.id), 'project.json.bak')));
        return { id: project.id, name: project.name, updatedAt: file.mtime.toISOString(), mediaCount: Object.keys(project.media).length, settings: project.settings };
      } catch { return null; }
    }));
    return entries.filter((entry): entry is ProjectSummary => entry !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async read(id: string): Promise<{ project: Project; recovered: boolean }> {
    const file = join(this.folder(id), 'project.json');
    try { return { project: parseProject(JSON.parse(await readFile(file, 'utf8')), id), recovered: false }; }
    catch {
      for (const recovery of [file + '.tmp', file + '.bak']) {
        try { return { project: parseProject(JSON.parse(await readFile(recovery, 'utf8')), id), recovered: true }; }
        catch { /* try the next recovery candidate */ }
      }
      throw new Error('Project could not be read. No valid recovery copy was found.');
    }
  }
  private async write(project: Project): Promise<void> {
    const folder = this.folder(project.id);
    await mkdir(folder, { recursive: true });
    const file = join(folder, 'project.json');
    // Save the validated previous content. Never back up a corrupt primary over valid recovery data.
    const previous = await this.read(project.id).catch(() => null);
    if (previous) await writeFile(file + '.bak', JSON.stringify(previous.project), 'utf8');
    await writeFile(file + '.tmp', JSON.stringify(project, null, 2), { encoding: 'utf8', flush: true });
    await rename(file + '.tmp', file);
  }
  private enqueue<T>(id: string, action: () => Promise<T>): Promise<T> {
    this.folder(id);
    const work = (this.queues.get(id) ?? Promise.resolve()).catch(() => {}).then(action);
    this.queues.set(id, work);
    void work.finally(() => { if (this.queues.get(id) === work) this.queues.delete(id); }).catch(() => {});
    return work;
  }
  async create(name: string, settings: Project['settings']): Promise<Project> {
    const project = createProject(randomUUID(), name, settings);
    await this.write(project);
    return project;
  }
  async update(id: string, mutate: (project: Project) => void): Promise<Project> {
    return this.enqueue(id, async () => {
      const { project } = await this.read(id);
      mutate(project);
      validSettings(project.settings);
      await this.write(project);
      return project;
    });
  }
  async duplicate(id: string): Promise<Project> {
    return this.enqueue(id, async () => {
      const { project } = await this.read(id);
      const oldFolder = this.folder(id);
      project.id = randomUUID();
      project.name = project.name.slice(0, 110) + ' copy';
      const folder = this.folder(project.id);
      await mkdir(folder, { recursive: true });
      for (const name of ['proxies', 'peaks', 'thumbs', 'captions']) {
        await cp(join(oldFolder, name), join(folder, name), { recursive: true }).catch(error => { if (error.code !== 'ENOENT') throw error; });
      }
      for (const asset of Object.values(project.media)) {
        for (const key of ['proxyPath', 'peaksPath', 'thumbDir'] as const) {
          if (asset[key]?.startsWith(oldFolder)) asset[key] = folder + asset[key]!.slice(oldFolder.length);
        }
      }
      await this.write(project);
      return project;
    });
  }
  async remove(id: string): Promise<void> { await this.enqueue(id, () => rm(this.folder(id), { recursive: true, force: true })); }
  async remember(id: string): Promise<void> {
    this.folder(id);
    await mkdir(this.root, { recursive: true });
    await writeFile(join(this.root, 'last-project.json'), JSON.stringify(id), 'utf8');
  }
  async last(): Promise<string | null> {
    try { const id = JSON.parse(await readFile(join(this.root, 'last-project.json'), 'utf8')); await this.read(id); return id; }
    catch { return null; }
  }
}
