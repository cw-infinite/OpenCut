import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { SavedTextPreset } from '../../shared/types';
import { validateSavedTextPreset } from '../../renderer/engine/textValidation';
import type { ProjectStore } from './projectStore';

export class TextPresetStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private projects: ProjectStore) {}

  merge(input: Record<string, SavedTextPreset>, overwrite = false, removeName?: string): Promise<Record<string, SavedTextPreset>> {
    const work = this.queue.catch(() => {}).then(async () => {
      if (!input || typeof input !== 'object' || Array.isArray(input) || typeof overwrite !== 'boolean') throw new Error('Invalid text presets');
      for (const [name, style] of Object.entries(input)) {
        if (!name.trim() || name.length > 80) throw new Error('Invalid preset name');
        validateSavedTextPreset(style);
      }
      if (removeName !== undefined && (typeof removeName !== 'string' || !removeName.trim() || removeName.length > 80)) throw new Error('Invalid preset name');
      const file = join(this.projects.root, 'text-presets.json');
      let deleted: string[] = [];
      let saved: Record<string, SavedTextPreset> = {};
      try { const data = JSON.parse(await readFile(file, 'utf8')); if (data.version === 2 && data.styles && Array.isArray(data.deleted)) { saved = data.styles; deleted = data.deleted; } else saved = data; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid saved text presets');
      for (const style of Object.values(saved)) validateSavedTextPreset(style);
      // Recover old project-only presets even if their source project is never opened.
      const recovered: Record<string, SavedTextPreset> = {};
      for (const summary of await this.projects.list()) {
        const { project } = await this.projects.readStable(summary.id);
        for (const [name, style] of Object.entries(project.captionStyles)) {
          try { validateSavedTextPreset(style); if (!Object.hasOwn(recovered, name)) Object.defineProperty(recovered, name, { value: style, enumerable: true }); } catch { /* Ignore invalid legacy styles. */ }
        }
      }
      const next = overwrite ? { ...recovered, ...saved, ...input } : { ...recovered, ...input, ...saved };
      if (overwrite) deleted = deleted.filter(name => !Object.hasOwn(input, name));
      if (removeName) deleted = [...new Set([...deleted, removeName])];
      for (const name of deleted) delete next[name];
      await mkdir(this.projects.root, { recursive: true });
      await writeFile(file + '.tmp', JSON.stringify({ version: 2, styles: next, deleted }, null, 2), { encoding: 'utf8', flush: true });
      await rename(file + '.tmp', file);
      return next;
    });
    this.queue = work;
    return work;
  }
}
