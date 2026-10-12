import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { database, required } from './supabase';
import { PublicError } from './public-error';

export async function reserveGeneration(request: Request, tokenHash: string) {
  if (process.env.BUSINESS_STORE !== 'supabase') return;
  const secret = required('ABUSE_HASH_SECRET');
  const hash = (value: string) => createHmac('sha256', secret).update(value).digest('hex');
  const jar = await cookies();
  const existing = jar.get('izak-review-session')?.value || '';
  const [id, signature] = existing.split('.');
  const valid =
    /^[a-f0-9]{32}$/.test(id || '') &&
    /^[a-f0-9]{64}$/.test(signature || '') &&
    timingSafeEqual(Buffer.from(hash(id)), Buffer.from(signature));
  const session = valid ? id : randomBytes(16).toString('hex');
  jar.set('izak-review-session', `${session}.${hash(session)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 86400,
  });
  // Vercel overwrites this header. Never trust arbitrary forwarded headers on other hosts.
  const ip =
    process.env.VERCEL === '1'
      ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim()
      : process.env.NODE_ENV !== 'production'
        ? 'local'
        : undefined;
  if (!ip) throw new PublicError('Abuse protection is not configured.', 503);
  const day = new Date().toISOString().slice(0, 10);
  const { data, error } = await database().rpc('reserve_generation', {
    p_token_hash: tokenHash,
    p_ip: hash(`${day}:${ip}`),
    p_session: hash(`${day}:${session}`),
  });
  if (error) throw new PublicError('Review tools are temporarily unavailable.', 503);
  if (data === 'unavailable') throw new PublicError('This review page is unavailable.', 404);
  if (data !== 'ok')
    throw new PublicError(
      'Generation limit reached. Please try again later or write directly on Google.',
      429,
    );
}
