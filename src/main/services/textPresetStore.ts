import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { TextStyle } from '../../shared/types';
import { validateTextStyle } from '../../renderer/engine/textValidation';
import type { ProjectStore } from './projectStore';

export class TextPresetStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private projects: ProjectStore) {}

  merge(input: Record<string, TextStyle>, overwrite = false): Promise<Record<string, TextStyle>> {
    const work = this.queue.catch(() => {}).then(async () => {
      if (!input || typeof input !== 'object' || Array.isArray(input) || typeof overwrite !== 'boolean') throw new Error('Invalid text presets');
      for (const [name, style] of Object.entries(input)) {
        if (!name.trim() || name.length > 80) throw new Error('Invalid preset name');
        validateTextStyle(style);
      }
      const file = join(this.projects.root, 'text-presets.json');
      let saved: Record<string, TextStyle> = {};
      try { saved = JSON.parse(await readFile(file, 'utf8')); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid saved text presets');
      for (const style of Object.values(saved)) validateTextStyle(style);
      // Recover old project-only presets even if their source project is never opened.
      const recovered: Record<string, TextStyle> = {};
      for (const summary of await this.projects.list()) {
        const { project } = await this.projects.readStable(summary.id);
        for (const [name, style] of Object.entries(project.captionStyles)) {
          try { validateTextStyle(style); if (!Object.hasOwn(recovered, name)) Object.defineProperty(recovered, name, { value: style, enumerable: true }); } catch { /* Ignore invalid legacy styles. */ }
        }
      }
      const next = overwrite ? { ...recovered, ...saved, ...input } : { ...recovered, ...input, ...saved };
      await mkdir(this.projects.root, { recursive: true });
      await writeFile(file + '.tmp', JSON.stringify(next, null, 2), { encoding: 'utf8', flush: true });
      await rename(file + '.tmp', file);
      return next;
    });
    this.queue = work;
    return work;
  }
}
