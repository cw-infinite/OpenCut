import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifiedDownload } from '../src/main/services/download';

const folders: string[] = [];
afterEach(async () => { vi.unstubAllGlobals(); await Promise.all(folders.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function destination(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), 'opencut-download-test-'));
  folders.push(folder);
  return join(folder, 'model.bin');
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
describe('verified tool downloads', () => {
  it('streams and validates an artifact, then skips the network on repeat setup', async () => {
    const path = await destination();
    const fetch = vi.fn().mockResolvedValue(new Response('verified tool', { headers: { 'content-length': '13' } }));
    vi.stubGlobal('fetch', fetch);
    await verifiedDownload('https://example.test/tool', path, digest('verified tool'), () => {});
    expect(await readFile(path, 'utf8')).toBe('verified tool');
    await verifiedDownload('https://example.test/tool', path, digest('verified tool'), () => {});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects a corrupt download, preserves an existing file and removes partial output', async () => {
    const path = await destination();
    await writeFile(path, 'old tool');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('corrupted')));
    await expect(verifiedDownload('https://example.test/tool', path, digest('expected'), () => {})).rejects.toThrow('checksum');
    expect(await readFile(path, 'utf8')).toBe('old tool');
    await expect(stat(path + '.part')).rejects.toThrow();
  });
  it('reports HTTP errors without creating a success artifact', async () => {
    const path = await destination();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('missing', { status: 404 })));
    await expect(verifiedDownload('https://example.test/tool', path, digest('expected'), () => {})).rejects.toThrow('404');
    await expect(stat(path)).rejects.toThrow();
  });
});
