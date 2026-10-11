import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { authorizeClient, loadClients, publicClient } from '../src/lib/clients';
const file = vi.hoisted(() => ({ value: '[]' }));
vi.mock('node:fs', () => ({ readFileSync: () => file.value }));
const token = 'a'.repeat(43);
const client = {
  id: 'test-cafe',
  name: 'Test Cafe',
  logo_url: 'https://example.com/logo.png',
  google_review_url: 'https://g.page/r/test/review',
  token_hash: createHash('sha256').update(token).digest('hex'),
  status: 'active',
};
beforeEach(() => {
  file.value = JSON.stringify([client]);
});
afterEach(() => vi.unstubAllEnvs());
it('allows only an active configured token and sends only display fields to the browser', () => {
  expect(authorizeClient(token).id).toBe(client.id);
  expect(publicClient(authorizeClient(token))).toEqual({
    name: client.name,
    logo_url: client.logo_url,
    google_review_url: client.google_review_url,
    category: '',
    city: '',
    description: '',
  });
  expect(() => authorizeClient('b'.repeat(43))).toThrow('unavailable');
  expect(() => authorizeClient(client.id)).toThrow('unavailable');
});
it('re-reads activation and rotated tokens on every check', () => {
  authorizeClient(token);
  file.value = JSON.stringify([{ ...client, status: 'inactive' }]);
  expect(() => authorizeClient(token)).toThrow('unavailable');
  file.value = JSON.stringify([
    { ...client, token_hash: createHash('sha256').update('b'.repeat(43)).digest('hex') },
  ]);
  expect(() => authorizeClient(token)).toThrow('unavailable');
  expect(authorizeClient('b'.repeat(43)).id).toBe(client.id);
});
it.each([
  '{',
  '[{}]',
  JSON.stringify([client, client]),
  JSON.stringify([{ ...client, google_review_url: 'https://evil.example/maps' }]),
  JSON.stringify([{ ...client, logo_url: 'javascript:alert(1)' }]),
])('fails closed for invalid configuration', (value) => {
  file.value = value;
  expect(() => loadClients()).toThrow('secure server setup');
});
