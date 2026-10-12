import { z } from 'zod';
import { clientSchema } from './client-schema';

export const businessInput = clientSchema
  .pick({ name: true, google_review_url: true, category: true, city: true, status: true })
  .extend({
    category: z.string().trim().min(1).max(100),
    city: z.string().trim().min(1).max(100),
    seo_keywords: z.array(z.string().trim().min(1).max(80)).max(20),
    daily_limit: z.number().int().min(1).max(10000),
  })
  .strict();
export type BusinessInput = z.infer<typeof businessInput>;
export type AdminBusiness = BusinessInput & { id: string; logo_url: string; created_at: string };
