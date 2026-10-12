import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { PublicError } from './public-error';

export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new PublicError('Secure server setup is incomplete.', 503);
  return value;
}
export function database() {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}
export async function authClient() {
  const jar = await cookies();
  return createServerClient(required('SUPABASE_URL'), required('SUPABASE_PUBLISHABLE_KEY'), {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) {
          try {
            jar.set(name, value, options);
          } catch {
            /* Pages cannot refresh cookies; the session endpoint can. */
          }
        }
      },
    },
  });
}
export async function requireAdmin() {
  const adminId = required('ADMIN_USER_ID');
  const client = await authClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new PublicError('Please sign in.', 401);
  if (user.id !== adminId) throw new PublicError('Access denied.', 403);
  return client;
}
