import { requireAdmin, database } from '@/lib/supabase';
import { businessColumns } from '@/lib/businesses';
import { businessInput } from '@/lib/business-schema';
import { issueToken } from '@/lib/review-tokens';
import { readReviewRequest } from '@/lib/request';
import { PublicError, publicFailure } from '@/lib/public-error';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await requireAdmin();
    const { data, error } = await database()
      .from('businesses')
      .select(businessColumns)
      .order('created_at', { ascending: false })
      .limit(10000);
    if (error) throw new PublicError('Unable to load businesses.', 503);
    return Response.json({ businesses: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return publicFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = businessInput.safeParse(await readReviewRequest(request));
    if (!input.success) throw new PublicError(input.error.issues[0].message);
    // New businesses remain inactive until their required logo is uploaded.
    const { data, error } = await database()
      .from('businesses')
      .insert({ ...input.data, status: 'inactive', ...issueToken() })
      .select(businessColumns)
      .single();
    if (error) throw new PublicError('Unable to create business.', 503);
    return Response.json(
      { business: data },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return publicFailure(error);
  }
}
