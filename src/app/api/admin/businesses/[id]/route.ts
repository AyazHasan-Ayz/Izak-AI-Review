import { z } from 'zod';
import { requireAdmin, database } from '@/lib/supabase';
import { businessColumns } from '@/lib/businesses';
import { businessInput } from '@/lib/business-schema';
import { issueToken } from '@/lib/review-tokens';
import { readReviewRequest } from '@/lib/request';
import { PublicError, publicFailure } from '@/lib/public-error';

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    await requireAdmin();
    const id = z.uuid().parse((await context.params).id);
    const body = await readReviewRequest(request);
    const rotate = z
      .object({ action: z.literal('rotate') })
      .strict()
      .safeParse(body);
    const parsed = businessInput.safeParse(body);
    if (!rotate.success && !parsed.success) throw new PublicError('Check business details.');
    const db = database();
    if (parsed.success && parsed.data.status === 'active') {
      const { data } = await db.from('businesses').select('logo_path').eq('id', id).single();
      if (!data?.logo_path) throw new PublicError('Upload a business logo before activation.');
    }
    const { data, error } = await db
      .from('businesses')
      .update(rotate.success ? issueToken() : parsed.data!)
      .eq('id', id)
      .select(businessColumns)
      .maybeSingle();
    if (error) throw new PublicError('Unable to update business.', 503);
    if (!data) throw new PublicError('Business not found.', 404);
    return Response.json({ business: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return publicFailure(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    await requireAdmin();
    const id = z.uuid().parse((await context.params).id);
    const body = z
      .object({ confirm: z.string() })
      .strict()
      .safeParse(await readReviewRequest(request));
    if (!body.success || body.data.confirm !== id)
      throw new PublicError('Deletion confirmation is required.');
    const db = database();
    const { data, error } = await db
      .from('businesses')
      .delete()
      .eq('id', id)
      .select('logo_path')
      .maybeSingle();
    if (error) throw new PublicError('Unable to delete business.', 503);
    if (!data) throw new PublicError('Business not found.', 404);
    // Revoke the business first; a storage outage must never leave its token active.
    let warning: string | undefined;
    if (data.logo_path) {
      const removed = await db.storage.from('business-logos').remove([data.logo_path]);
      if (removed.error)
        warning = 'Business deleted. Its unused logo requires cleanup in Supabase Storage.';
    }
    return Response.json({ ok: true, warning }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return publicFailure(error);
  }
}
