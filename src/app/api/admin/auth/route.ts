import { z } from 'zod';
import { authClient, requireAdmin, required } from '@/lib/supabase';
import { readReviewRequest } from '@/lib/request';
import { PublicError, publicFailure } from '@/lib/public-error';

export const dynamic = 'force-dynamic';
const input = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('login'),
      email: z.email().max(254),
      password: z.string().min(1).max(128),
    })
    .strict(),
  z.object({ action: z.literal('recover'), email: z.email().max(254) }).strict(),
  z.object({ action: z.literal('password'), password: z.string().min(12).max(128) }).strict(),
  z.object({ action: z.literal('logout') }).strict(),
]);
export async function POST(request: Request) {
  try {
    const parsed = input.safeParse(await readReviewRequest(request));
    if (!parsed.success)
      throw new PublicError(
        'Check the supplied credentials. Passwords must be at least 12 characters when changing them.',
      );
    const body = parsed.data;
    const adminId = required('ADMIN_USER_ID');
    const client = await authClient();
    if (body.action === 'login') {
      const { data, error } = await client.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });
      if (error || data.user?.id !== adminId) {
        await client.auth.signOut({ scope: 'local' });
        throw new PublicError('Unable to sign in with these credentials.', 401);
      }
    } else if (body.action === 'recover') {
      // A generic response prevents account enumeration. Supabase rate limits email delivery.
      await client.auth.resetPasswordForEmail(body.email, {
        redirectTo: new URL('/admin/reset-password', required('APP_URL')).href,
      });
    } else {
      const admin = await requireAdmin();
      if (body.action === 'logout') {
        const { error } = await admin.auth.signOut({ scope: 'global' });
        if (error) throw new PublicError('Unable to sign out. Please try again.', 503);
      } else {
        const { error } = await admin.auth.updateUser({ password: body.password });
        if (error)
          throw new PublicError(
            'Unable to update password. Request a fresh recovery link or try a different password.',
          );
        const { error: logoutError } = await admin.auth.signOut({ scope: 'global' });
        if (logoutError)
          throw new PublicError(
            'Password updated. Please sign out again to revoke existing sessions.',
            503,
          );
      }
    }
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return publicFailure(error);
  }
}

export async function GET() {
  try {
    await requireAdmin();
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return publicFailure(error);
  }
}
