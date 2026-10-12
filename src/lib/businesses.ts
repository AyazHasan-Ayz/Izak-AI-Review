import 'server-only';
import { database, required } from './supabase';
import { authorizeClient } from './clients';
import { clientSchema } from './client-schema';
import { hashToken, decryptToken } from './review-tokens';
import { tokenPattern } from './validation';
import { PublicError } from './public-error';

export const businessColumns =
  'id,name,logo_url,google_review_url,category,city,status,seo_keywords,daily_limit,created_at';
export async function resolveClient(token: string) {
  if (process.env.BUSINESS_STORE !== 'supabase') return authorizeClient(token);
  if (!tokenPattern.test(token)) throw new PublicError('This review page is unavailable.', 404);
  const { data, error } = await database()
    .from('businesses')
    .select('id,name,logo_url,google_review_url,token_hash,status,category,city,review_settings')
    .eq('token_hash', hashToken(token))
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new PublicError('Review tools are temporarily unavailable.', 503);
  if (!data) throw new PublicError('This review page is unavailable.', 404);
  const settings = clientSchema
    .pick({ description: true, language: true, products: true, review_length: true })
    .parse(data.review_settings);
  return clientSchema.parse({
    id: data.id,
    name: data.name,
    logo_url: data.logo_url,
    google_review_url: data.google_review_url,
    token_hash: data.token_hash,
    status: data.status,
    category: data.category,
    city: data.city,
    ...settings,
  });
}
export function reviewUrl(encrypted: string) {
  const origin = new URL(required('APP_URL'));
  if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')
    throw new Error('HTTPS required');
  return new URL(`/r/${decryptToken(encrypted)}`, origin.origin).href;
}
