import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({ rpc: vi.fn(), set: vi.fn(), cookie: '' }));
vi.mock('../src/lib/supabase', () => ({
  database: () => ({ rpc: state.rpc }),
  required: (key: string) => {
    if (!process.env[key]) throw new Error('Missing');
    return process.env[key];
  },
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: state.cookie }), set: state.set }),
}));
import { reserveGeneration } from '../src/lib/usage';
beforeEach(() => {
  vi.clearAllMocks();
  state.cookie = '';
  vi.stubEnv('BUSINESS_STORE', 'supabase');
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('ABUSE_HASH_SECRET', 'test-hash-secret');
  state.rpc.mockResolvedValue({ data: 'ok', error: null });
});
afterEach(() => vi.unstubAllEnvs());
const request = () =>
  new Request('https://izak-ai.vercel.app', {
    headers: { 'x-vercel-forwarded-for': '192.0.2.1', 'x-forwarded-for': 'attacker' },
  });
it('stores only daily keyed hashes and signs the essential session cookie', async () => {
  await reserveGeneration(request(), 'a'.repeat(64));
  const args = state.rpc.mock.calls[0][1];
  expect(args.p_ip).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(args)).not.toContain('192.0.2.1');
  const cookie = state.set.mock.calls[0][1];
  state.cookie = cookie;
  await reserveGeneration(request(), 'a'.repeat(64));
  expect(state.rpc.mock.calls[1][1].p_session).toBe(args.p_session);
  state.cookie = cookie.slice(0, -1) + (cookie.endsWith('a') ? 'b' : 'a');
  await reserveGeneration(request(), 'a'.repeat(64));
  expect(state.rpc.mock.calls[2][1].p_session).not.toBe(args.p_session);
});
it.each([
  ['limited', 429],
  ['unavailable', 404],
])('fails closed for %s', async (data, status) => {
  state.rpc.mockResolvedValue({ data, error: null });
  await expect(reserveGeneration(request(), 'a'.repeat(64))).rejects.toMatchObject({ status });
});
it('does not allow generation if durable counters or trusted IP are unavailable', async () => {
  state.rpc.mockResolvedValue({ error: new Error('offline') });
  await expect(reserveGeneration(request(), 'a'.repeat(64))).rejects.toMatchObject({ status: 503 });
  state.rpc.mockClear();
  await expect(
    reserveGeneration(new Request('https://izak-ai.vercel.app'), 'a'.repeat(64)),
  ).rejects.toMatchObject({ status: 503 });
  expect(state.rpc).not.toHaveBeenCalled();
});
