import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { clientListSchema } from '../src/lib/client-schema.ts';

// Owner-only, one-time import. No credentials, raw tokens or ciphertext are printed.
try {
  const rawKey = process.env.REVIEW_TOKEN_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(rawKey)) throw new Error('Configure REVIEW_TOKEN_ENCRYPTION_KEY.');
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const clients = clientListSchema.parse(
    JSON.parse(readFileSync(resolve(process.env.CLIENTS_FILE || 'private/clients.json'), 'utf8')),
  );
  const { count, error } = await db.from('businesses').select('id', { count: 'exact', head: true });
  if (error || count !== 0)
    throw new Error('Import requires an accessible, empty businesses table.');
  const rows = clients.map((client) => {
    const token = readFileSync(resolve('private/issued', `${client.id}.token`), 'utf8').trim();
    if (createHash('sha256').update(token).digest('hex') !== client.token_hash)
      throw new Error('A saved client token is missing or does not match. Import stopped.');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(rawKey, 'hex'), iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return {
      id: randomUUID(),
      name: client.name,
      logo_url: client.logo_url,
      google_review_url: client.google_review_url,
      category: client.category || 'Business',
      city: client.city || 'Not specified',
      status: client.status,
      token_hash: client.token_hash,
      token_encrypted: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url'),
      daily_limit: 100,
      review_settings: {
        description: client.description,
        language: client.language,
        products: client.products,
        review_length: client.review_length,
      },
    };
  });
  if (rows.length) {
    const { error: insert } = await db.from('businesses').insert(rows);
    if (insert)
      throw new Error('Import failed. No partial batch was inserted. Check database constraints.');
  }
  console.log(
    `Imported ${rows.length} businesses with unchanged review URLs. New database UUIDs assigned. Verify before switching BUSINESS_STORE.`,
  );
} catch {
  console.error(
    'Import stopped. Check private files, matching owner tokens, environment variables and an empty migrated database. No secrets displayed.',
  );
  process.exitCode = 1;
}
