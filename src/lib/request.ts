import 'server-only';
import { PublicError } from './public-error';

export async function readReviewRequest(request: Request): Promise<unknown> {
  const configured = process.env.APP_URL;
  if (!configured && process.env.NODE_ENV === 'production')
    throw new PublicError('Review tools are awaiting secure server setup.', 503);
  const expected = new URL(configured || 'http://127.0.0.1:3000').origin;
  if (request.headers.get('origin') !== expected)
    throw new PublicError('This request did not come from the review website.', 403);
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    throw new PublicError('JSON is required.', 415);
  if (Number(request.headers.get('content-length') || 0) > 8192)
    throw new PublicError('Request is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PublicError('Request body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        throw new PublicError('Request is too large.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new PublicError('Invalid request.');
  }
}
