import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';

export async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
export async function verifiedDownload(url: string, destination: string, checksum: string,
  progress: (percent: number | null) => void): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  if (await sha256(destination).then(hash => hash === checksum).catch(() => false)) { progress(100); return; }
  const part = destination + '.part';
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20 * 60 * 1000), headers: { 'User-Agent': 'OpenCut-Setup' } });
    if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}): ${url}`);
    const total = Number(response.headers.get('content-length'));
    let bytes = 0, lastProgress = 0;
    const meter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (Date.now() - lastProgress > 250) { progress(total ? Math.round(bytes / total * 100) : null); lastProgress = Date.now(); }
      callback(null, chunk);
    } });
    await pipeline(Readable.fromWeb(response.body as never), meter, createWriteStream(part));
    if (await sha256(part) !== checksum) throw new Error('Download checksum mismatch. Please retry setup.');
    await rm(destination, { force: true });
    await rename(part, destination);
    progress(100);
  } finally { await rm(part, { force: true }); }
}
