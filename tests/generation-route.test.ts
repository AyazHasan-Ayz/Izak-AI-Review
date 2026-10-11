import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { POST } from '../src/app/api/review/[token]/generate/route';
const state = vi.hoisted(() => ({ value: '[]' }));
vi.mock('node:fs', () => ({ readFileSync: () => state.value }));
const token = 'a'.repeat(43);
const client = {
  id: 'test-cafe',
  name: 'Test Cafe',
  logo_url: 'https://example.com/logo.png',
  google_review_url: 'https://g.page/r/test/review',
  token_hash: createHash('sha256').update(token).digest('hex'),
  status: 'active',
  products: ['Tea'],
};
const input = {
  rating: 2,
  experience: 'The tea was cold and service was slow.',
  language: 'English',
};
const request = (body: unknown = input, origin = 'http://127.0.0.1:3000') =>
  new Request(`http://127.0.0.1:3000/api/review/${token}/generate`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const context = (value = token) => ({ params: Promise.resolve({ token: value }) });
beforeEach(() => {
  state.value = JSON.stringify([client]);
  vi.stubEnv('APP_URL', 'http://127.0.0.1:3000');
  vi.stubEnv('GROQ_API_KEY', 'test-key-never-public');
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          choices: [
            {
              message: { content: 'The tea was cold and service was slow.' },
              finish_reason: 'stop',
            },
          ],
        }),
      ),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('drafts from genuine input without transmitting business tokens or configuration to Groq', async () => {
  const response = await POST(request(), context());
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({ draft: input.experience });
  const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
  expect(JSON.parse(body.messages[1].content)).toEqual({ ...input, length: 'short' });
  expect(JSON.stringify(body)).not.toContain(token);
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
});
it.each(['wrong', 'b'.repeat(43)])(
  'rejects invalid or unknown tokens before calling Groq',
  async (value) => {
    expect((await POST(request(), context(value))).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  },
);
it('rejects inactive businesses even when the page was already loaded', async () => {
  state.value = JSON.stringify([{ ...client, status: 'inactive' }]);
  expect((await POST(request(), context())).status).toBe(404);
  expect(fetch).not.toHaveBeenCalled();
});
it('does not return a draft if the business is disabled during generation', async () => {
  vi.mocked(fetch).mockImplementation(async () => {
    state.value = JSON.stringify([{ ...client, status: 'inactive' }]);
    return Response.json({ choices: [{ message: { content: 'Draft.' }, finish_reason: 'stop' }] });
  });
  expect((await POST(request(), context())).status).toBe(404);
});
it.each([
  { ...input, businessId: 'another-client' },
  { ...input, token },
  { ...input, rating: 6 },
  { ...input, experience: 'short' },
  { ...input, product: 'Invented product' },
  { ...input, website: 'spam' },
])('rejects untrusted or invalid inputs', async (body) => {
  expect((await POST(request(body), context())).status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects cross-origin requests and does not leak internal failures', async () => {
  expect((await POST(request(input, 'https://evil.example'), context())).status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
  state.value = 'broken';
  const response = await POST(request(), context());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('test-key-never-public');
});
