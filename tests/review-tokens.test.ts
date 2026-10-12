import { afterEach, it, expect, vi } from 'vitest';
import { issueToken, decryptToken, hashToken } from '../src/lib/review-tokens';
afterEach(() => vi.unstubAllEnvs());
it('generates unique 256-bit links and authenticated ciphertext', () => {
  vi.stubEnv('REVIEW_TOKEN_ENCRYPTION_KEY', 'a'.repeat(64));
  const first = issueToken();
  const second = issueToken();
  const raw = decryptToken(first.token_encrypted);
  expect(raw).toMatch(/^[\w-]{43}$/);
  expect(hashToken(raw)).toBe(first.token_hash);
  expect(first.token_hash).not.toBe(second.token_hash);
  expect(first.token_encrypted).not.toContain(raw);
  const bytes = Buffer.from(first.token_encrypted, 'base64url');
  bytes[30] ^= 1;
  expect(() => decryptToken(bytes.toString('base64url'))).toThrow();
  vi.stubEnv('REVIEW_TOKEN_ENCRYPTION_KEY', 'b'.repeat(64));
  expect(() => decryptToken(first.token_encrypted)).toThrow();
});
it('fails closed when encryption is not configured', () => {
  vi.stubEnv('REVIEW_TOKEN_ENCRYPTION_KEY', '');
  expect(() => issueToken()).toThrow();
});
