import { z } from 'zod';
export const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
export const generationSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    experience: z
      .string()
      .trim()
      .min(10, 'Please share at least 10 characters about your experience.')
      .max(1500),
    language: z.enum(['English', 'Hindi', 'Hinglish']),
    product: z.string().max(80).optional(),
    website: z.string().max(0).optional(),
  })
  .strict();
