import { generationSchema } from '@/lib/validation';
import { authorizeClient } from '@/lib/clients';
import { readReviewRequest } from '@/lib/request';
import { PublicError, publicFailure } from '@/lib/public-error';
import { generateReview } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const client = authorizeClient(token);
    const parsed = generationSchema.safeParse(await readReviewRequest(request));
    if (!parsed.success) throw new PublicError(parsed.error.issues[0].message);
    const { rating, experience, language, product } = parsed.data;
    if (product && !client.products.includes(product))
      throw new PublicError('Please select a listed product or service.');
    const draft = await generateReview({
      rating,
      experience,
      language,
      product,
      length: client.review_length,
    });
    // Recheck before returning a result if configuration changed while Groq was responding.
    authorizeClient(token);
    return Response.json({ draft: draft.content }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return publicFailure(error);
  }
}
