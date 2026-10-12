import { NextResponse } from 'next/server';
import { authClient, required } from '@/lib/supabase';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hash = url.searchParams.get('token_hash');
  const destination = new URL('/admin/login?recovery=failed', required('APP_URL'));
  if (hash && url.searchParams.get('type') === 'recovery') {
    const client = await authClient();
    const { data, error } = await client.auth.verifyOtp({ token_hash: hash, type: 'recovery' });
    if (!error && data.user?.id === required('ADMIN_USER_ID'))
      destination.pathname = '/admin/reset-password';
    else await client.auth.signOut({ scope: 'local' });
  }
  const response = NextResponse.redirect(destination);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
