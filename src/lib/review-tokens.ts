import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { required } from './supabase';

function key() {
  const raw = required('REVIEW_TOKEN_ENCRYPTION_KEY');
  if (!/^[a-f0-9]{64}$/i.test(raw)) throw new Error('Invalid token encryption key');
  return Buffer.from(raw, 'hex');
}
export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export function issueToken() {
  const token = randomBytes(32).toString('base64url');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return {
    token_hash: hashToken(token),
    token_encrypted: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url'),
  };
}
export function decryptToken(value: string) {
  const bytes = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
}
