import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { PublicError } from '../src/lib/public-error';
const mock = vi.hoisted(() => ({
  user: null as null | { id: string },
  error: null as unknown,
  from: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
  update: vi.fn(),
  signIn: vi.fn(),
  recover: vi.fn(),
  jar: { getAll: vi.fn(() => []), set: vi.fn() },
}));
vi.mock('next/headers', () => ({ cookies: async () => mock.jar }));
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: mock.user }, error: mock.error }),
      signInWithPassword: mock.signIn,
      signOut: mock.signOut,
      updateUser: mock.update,
      resetPasswordForEmail: mock.recover,
    },
  }),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mock.from, rpc: mock.rpc }),
}));
import { requireAdmin } from '../src/lib/supabase';
import { GET, POST } from '../src/app/api/admin/businesses/route';
import { PATCH, DELETE } from '../src/app/api/admin/businesses/[id]/route';
import { POST as upload } from '../src/app/api/admin/businesses/[id]/logo/route';
import { GET as link } from '../src/app/api/admin/businesses/[id]/link/route';
import { POST as auth } from '../src/app/api/admin/auth/route';
const id = '8531f880-9cd9-44f5-8b86-a71a032eafed';
const context = { params: Promise.resolve({ id }) };
const request = (body: unknown = {}, origin = 'https://izak-ai.vercel.app') =>
  new Request('https://izak-ai.vercel.app/api/admin/businesses', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mock.user = null;
  mock.error = null;
  vi.stubEnv('ADMIN_USER_ID', id);
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'test-publishable');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-secret');
  vi.stubEnv('APP_URL', 'https://izak-ai.vercel.app');
  mock.signOut.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
it('requires an explicitly configured admin UUID and authentic user', async () => {
  await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  mock.user = { id: 'other-user' };
  await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  mock.user = { id };
  await expect(requireAdmin()).resolves.toBeTruthy();
  mock.error = new Error('Invalid session');
  await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  vi.stubEnv('ADMIN_USER_ID', '');
  await expect(requireAdmin()).rejects.toMatchObject({ status: 503 });
});
describe.each([null, { id: 'unauthorized' }])('all admin data endpoints deny %s', (user) => {
  it('never touches the database or storage', async () => {
    mock.user = user;
    const responses = [
      await GET(),
      await POST(request()),
      await PATCH(request(), context),
      await DELETE(request(), context),
      await upload(request(), context),
      await link(request(), context),
    ];
    for (const response of responses) expect(response.status).toBe(user ? 403 : 401);
    expect(mock.from).not.toHaveBeenCalled();
  });
});
it('blocks cross-origin writes before any database action', async () => {
  mock.user = { id };
  for (const response of [
    await POST(request({}, 'https://evil.test')),
    await PATCH(request({}, 'https://evil.test'), context),
    await DELETE(request({}, 'https://evil.test'), context),
    await upload(request({}, 'https://evil.test'), context),
    await auth(request({ action: 'logout' }, 'https://evil.test')),
  ])
    expect(response.status).toBe(403);
  expect(mock.from).not.toHaveBeenCalled();
  expect(mock.signOut).not.toHaveBeenCalled();
});
it('rejects sign-in for another Supabase user and clears their session', async () => {
  mock.signIn.mockResolvedValue({ data: { user: { id: 'other' } }, error: null });
  expect(
    (await auth(request({ action: 'login', email: 'test@example.com', password: 'a-password' })))
      .status,
  ).toBe(401);
  expect(mock.signOut).toHaveBeenCalledWith({ scope: 'local' });
});
it('never exposes signup and does not let anonymous users change a password or logout', async () => {
  expect(
    (await auth(request({ action: 'signup', email: 'test@example.com', password: 'a-password' })))
      .status,
  ).toBe(400);
  expect(
    (await auth(request({ action: 'password', password: 'a-long-new-password' }))).status,
  ).toBe(401);
  expect((await auth(request({ action: 'logout' }))).status).toBe(401);
  expect(mock.update).not.toHaveBeenCalled();
});
it('validates mutations and explicit deletion confirmation', async () => {
  mock.user = { id };
  expect((await DELETE(request({ confirm: 'wrong' }), context)).status).toBe(400);
  expect((await POST(request({ name: 'x', token_hash: 'forged' }))).status).toBe(400);
  expect(mock.from).not.toHaveBeenCalled();
});
it('generic errors do not reveal service credentials', async () => {
  expect(new PublicError('Denied', 403).status).toBe(403);
  mock.user = { id };
  mock.from.mockImplementation(() => {
    throw new Error('test-secret');
  });
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('test-secret');
});

it('rejects oversized or executable image uploads before storage access', async () => {
  mock.user = { id };
  const imageRequest = (body: BodyInit) =>
    new Request('https://izak-ai.vercel.app/api/admin/logo', {
      method: 'POST',
      headers: { origin: 'https://izak-ai.vercel.app', 'Content-Type': 'image/png' },
      body,
    });
  expect((await upload(imageRequest(new Uint8Array(2097153)), context)).status).toBe(413);
  expect(
    (
      await upload(
        imageRequest(
          '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
        ),
        context,
      )
    ).status,
  ).toBe(400);
  expect(mock.from).not.toHaveBeenCalled();
});
