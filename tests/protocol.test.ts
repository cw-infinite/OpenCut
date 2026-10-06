import { it, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveMedia } from '../src/main/services/mediaProtocol';

it('serves exact byte ranges, suffixes and rejects out-of-range or unknown media', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'opencut-protocol-test-'));
  try {
    const path = join(folder, 'test.mp4'); await writeFile(path, '0123456789');
    const files = new Map([['token', path]]);
    const get = (range: string) => serveMedia(new Request('opencut-media://local/token', { headers: { range } }), files);
    const response = await get('bytes=3-6');
    expect(response.status).toBe(206); expect(response.headers.get('content-range')).toBe('bytes 3-6/10');
    expect(await response.text()).toBe('3456');
    expect(await (await get('bytes=-3')).text()).toBe('789');
    expect((await get('bytes=30-')).status).toBe(416);
    expect((await serveMedia(new Request('opencut-media://local/nope'), files)).status).toBe(404);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
