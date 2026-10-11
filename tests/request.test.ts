import { expect, it, afterEach, vi } from 'vitest';
import { readReviewRequest } from '../src/lib/request';
afterEach(() => vi.unstubAllEnvs());
function request(body: string, headers: Record<string, string> = {}) {
  vi.stubEnv('APP_URL', 'https://reviews.example');
  return new Request('https://reviews.example/api/review/a/generate', {
    method: 'POST',
    body,
    headers: { origin: 'https://reviews.example', 'content-type': 'application/json', ...headers },
  });
}
it('bounds the actual body even if content-length is missing or false', async () => {
  await expect(readReviewRequest(request('x'.repeat(8193)))).rejects.toMatchObject({ status: 413 });
  await expect(
    readReviewRequest(request('x'.repeat(8193), { 'content-length': '10' })),
  ).rejects.toMatchObject({ status: 413 });
});
it('rejects malformed JSON and non-JSON content', async () => {
  await expect(readReviewRequest(request('{'))).rejects.toMatchObject({ status: 400 });
  await expect(
    readReviewRequest(request('{}', { 'content-type': 'text/plain' })),
  ).rejects.toMatchObject({ status: 415 });
});
it('requires an explicit production origin', async () => {
  const req = request('{}');
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('APP_URL', '');
  await expect(readReviewRequest(req)).rejects.toMatchObject({ status: 503 });
});
