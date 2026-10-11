import { z } from 'zod';

const httpsUrl = z.url().refine((value) => {
  const u = new URL(value);
  return u.protocol === 'https:' && !u.username && !u.password && !u.port;
});
export const clientSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,79}$/),
    name: z.string().trim().min(2).max(100),
    logo_url: httpsUrl,
    google_review_url: httpsUrl.refine((value) => {
      const u = new URL(value);
      return (
        (u.hostname === 'search.google.com' &&
          u.pathname === '/local/writereview' &&
          !!u.searchParams.get('placeid')) ||
        (u.hostname === 'g.page' && /^\/r\/[^/]+\/review\/?$/.test(u.pathname)) ||
        (u.hostname === 'maps.app.goo.gl' && /^\/[a-zA-Z0-9_-]+$/.test(u.pathname)) ||
        (['www.google.com', 'maps.google.com'].includes(u.hostname) &&
          /^\/maps(\/|$)/.test(u.pathname))
      );
    }, 'Use an official HTTPS Google review or Maps URL'),
    token_hash: z.string().regex(/^[a-f0-9]{64}$/),
    status: z.enum(['active', 'inactive']),
    category: z.string().max(100).default(''),
    city: z.string().max(100).default(''),
    description: z.string().max(500).default(''),
    language: z.enum(['English', 'Hindi', 'Hinglish']).default('English'),
    products: z.array(z.string().min(1).max(80)).max(20).default([]),
    review_length: z.enum(['short', 'medium']).default('short'),
  })
  .strict();
export const clientListSchema = z
  .array(clientSchema)
  .max(10000)
  .refine(
    (clients) =>
      new Set(clients.map((c) => c.id)).size === clients.length &&
      new Set(clients.map((c) => c.token_hash)).size === clients.length,
    'Client IDs and token hashes must be unique',
  );
export type Client = z.infer<typeof clientSchema>;
