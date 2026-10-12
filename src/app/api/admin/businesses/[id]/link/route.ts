import { z } from 'zod';
import QRCode from 'qrcode';
import { requireAdmin, database } from '@/lib/supabase';
import { reviewUrl } from '@/lib/businesses';
import { PublicError, publicFailure } from '@/lib/public-error';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const id = z.uuid().parse((await context.params).id);
    const { data, error } = await database()
      .from('businesses')
      .select('token_encrypted')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new PublicError('Unable to load review link.', 503);
    if (!data) throw new PublicError('Business not found.', 404);
    const url = reviewUrl(data.token_encrypted);
    const format = new URL(request.url).searchParams.get('format');
    const headers = {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="izak-${id}.${format === 'svg' ? 'svg' : 'png'}"`,
    };
    if (format === 'svg')
      return new Response(await QRCode.toString(url, { type: 'svg', margin: 4 }), {
        headers: { ...headers, 'Content-Type': 'image/svg+xml' },
      });
    if (format === 'png')
      return new Response(new Uint8Array(await QRCode.toBuffer(url, { width: 1024, margin: 4 })), {
        headers: { ...headers, 'Content-Type': 'image/png' },
      });
    return Response.json({ url }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return publicFailure(error);
  }
}
