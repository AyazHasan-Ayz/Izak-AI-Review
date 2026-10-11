import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { clientListSchema, type Client } from './client-schema';
import { tokenPattern } from './validation';
import { PublicError } from './public-error';

export function loadClients(): Client[] {
  try {
    // Read on every request so file changes revoke access without a process restart.
    // next.config.ts explicitly traces the default file; do not trace the whole project for an override.
    const raw = readFileSync(
      resolve(
        /* turbopackIgnore: true */ process.cwd(),
        process.env.CLIENTS_FILE || 'private/clients.json',
      ),
      'utf8',
    );
    return clientListSchema.parse(JSON.parse(raw));
  } catch {
    throw new PublicError('Review tools are awaiting secure server setup.', 503);
  }
}
export function authorizeClient(token: string): Client {
  if (!tokenPattern.test(token)) throw new PublicError('This review page is unavailable.', 404);
  const hash = createHash('sha256').update(token).digest();
  const client = loadClients().find((c) => timingSafeEqual(Buffer.from(c.token_hash, 'hex'), hash));
  if (!client || client.status !== 'active')
    throw new PublicError('This review page is unavailable.', 404);
  return client;
}
export function publicClient(client: Client) {
  return {
    name: client.name,
    logo_url: client.logo_url,
    google_review_url: client.google_review_url,
    category: client.category,
    city: client.city,
    description: client.description,
  };
}
