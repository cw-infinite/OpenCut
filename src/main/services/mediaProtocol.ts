import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { extname } from 'node:path';

const contentTypes: Record<string, string> = { '.mp4': 'video/mp4', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
/** Custom protocols need explicit byte ranges for Chromium's media seeking. */
export async function serveMedia(request: Request, files: Map<string, string>): Promise<Response> {
  const url = new URL(request.url);
  const path = url.hostname === 'local' ? files.get(url.pathname.slice(1)) : undefined;
  if (!path || !['GET', 'HEAD'].includes(request.method)) return new Response('Unknown media', { status: 404 });
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) return new Response('Media file is missing', { status: 404 });
  const size = info.size;
  const headers = new Headers({ 'Content-Type': contentTypes[extname(path)] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' });
  let start = 0, end = size - 1, status = 200;
  const range = request.headers.get('range');
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    if (!match[1]) start = Math.max(0, size - Number(match[2]));
    else { start = Number(match[1]); end = match[2] ? Math.min(end, Number(match[2])) : end; }
    if (start > end || start >= size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    status = 206;
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  }
  headers.set('Content-Length', String(Math.max(0, end - start + 1)));
  const body = request.method === 'HEAD' || size === 0 ? null : Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(body, { status, headers });
}
