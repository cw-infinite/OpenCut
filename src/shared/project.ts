import type { Project } from './types';
export const frameRates = [24, 25, 30, 50, 60] as const;
export function validSettings(value: Project['settings']): void {
  if (!value || !Number.isInteger(value.width) || !Number.isInteger(value.height) ||
    value.width < 64 || value.height < 64 || value.width > 1920 || value.height > 1920 ||
    Math.min(value.width, value.height) > 1080 || value.width % 2 || value.height % 2 ||
    !frameRates.includes(value.fps as 30) || value.sampleRate !== 48000) {
    throw new Error('Use even dimensions from 64 to 1920 (short edge at most 1080), and a supported frame rate.');
  }
}
export function createProject(id: string, name: string, settings: Project['settings']): Project {
  validSettings(settings);
  if (typeof name !== 'string' || !name.trim() || name.length > 120) throw new Error('Project name must contain 1–120 characters.');
  return { id, name: name.trim(), version: 1, settings, media: {}, tracks: [], markers: [], captionStyles: {} };
}
export function parseProject(value: unknown, id: string): Project {
  const project = value as Project;
  if (!project || project.version !== 1 || project.id !== id || !project.media ||
    !Array.isArray(project.tracks) || !Array.isArray(project.markers) || typeof project.name !== 'string') {
    throw new Error('Invalid or unsupported OpenCut project');
  }
  validSettings(project.settings);
  return project;
}
