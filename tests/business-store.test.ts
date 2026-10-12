import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({
  from: vi.fn(),
  result: { data: null as unknown, error: null as unknown },
  select: vi.fn(),
  eq: vi.fn(),
}));
vi.mock('../src/lib/supabase', () => ({
  database: () => ({ from: state.from }),
  required: (key: string) => process.env[key],
}));
import { resolveClient } from '../src/lib/businesses';
import { publicClient } from '../src/lib/clients';
const row = {
  id: '8531f880-9cd9-44f5-8b86-a71a032eafed',
  name: 'Test Business',
  logo_url: 'https://example.com/logo.webp',
  google_review_url: 'https://g.page/r/test/review',
  token_hash: 'a'.repeat(64),
  status: 'active',
  category: 'Cafe',
  city: 'Mumbai',
  review_settings: {},
  seo_keywords: ['never in a review'],
  token_encrypted: 'private-ciphertext',
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('BUSINESS_STORE', 'supabase');
  state.result = { data: row, error: null };
  const chain = { select: state.select, eq: state.eq, maybeSingle: async () => state.result };
  state.from.mockReturnValue(chain);
  state.select.mockReturnValue(chain);
  state.eq.mockReturnValue(chain);
});
afterEach(() => vi.unstubAllEnvs());
it('resolves a hash and active status server-side without fetching ciphertext or SEO keywords', async () => {
  const client = await resolveClient('a'.repeat(43));
  expect(client.id).toBe(row.id);
  expect(state.eq).toHaveBeenCalledWith('status', 'active');
  expect(state.eq.mock.calls[0][1]).toMatch(/^[a-f0-9]{64}$/);
  expect(state.select.mock.calls[0][0]).not.toContain('token_encrypted');
  expect(state.select.mock.calls[0][0]).not.toContain('seo_keywords');
  expect(JSON.stringify(publicClient(client))).not.toMatch(/token|seo_keywords/);
});
it('does not use the legacy file store when Supabase is unavailable', async () => {
  state.result = { data: null, error: new Error('offline') };
  await expect(resolveClient('a'.repeat(43))).rejects.toMatchObject({ status: 503 });
  state.result = { data: null, error: null };
  await expect(resolveClient('a'.repeat(43))).rejects.toMatchObject({ status: 404 });
});
it('rejects malformed browser tokens without querying the database', async () => {
  await expect(resolveClient('business-id')).rejects.toMatchObject({ status: 404 });
  expect(state.from).not.toHaveBeenCalled();
});
