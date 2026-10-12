import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import sharp from 'sharp';
import { requireAdmin, database, required } from '@/lib/supabase';
import { PublicError, publicFailure } from '@/lib/public-error';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    if (request.headers.get('origin') !== new URL(required('APP_URL')).origin)
      throw new PublicError('Invalid origin.', 403);
    const id = z.uuid().parse((await context.params).id);
    // Read raw image bytes with a streaming cap, not an unbounded multipart body.
    const reader = request.body?.getReader();
    if (!reader) throw new PublicError('Choose a logo.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2097152) {
          await reader.cancel();
          throw new PublicError('Logo must be under 2 MB.', 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = Buffer.concat(chunks);
    const image = sharp(bytes, { limitInputPixels: 16000000 });
    const metadata = await image.metadata().catch(() => null);
    if (
      !metadata ||
      !['png', 'jpeg', 'webp'].includes(metadata.format || '') ||
      (metadata.pages || 1) > 1
    )
      throw new PublicError('Use a static PNG, JPEG or WebP logo.');
    const normalized = await image
      .rotate()
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .webp()
      .toBuffer()
      .catch(() => {
        throw new PublicError('The logo is damaged or unsupported. Choose a different image.');
      });
    const db = database();
    const { data: business } = await db
      .from('businesses')
      .select('logo_path')
      .eq('id', id)
      .maybeSingle();
    if (!business) throw new PublicError('Business not found.', 404);
    const path = `${id}/${randomUUID()}.webp`;
    const bucket = db.storage.from('business-logos');
    const { error: upload } = await bucket.upload(path, normalized, {
      contentType: 'image/webp',
      upsert: false,
    });
    if (upload) throw new PublicError('Logo upload failed.', 503);
    const logo_url = bucket.getPublicUrl(path).data.publicUrl;
    const { data, error } = await db
      .from('businesses')
      .update({ logo_path: path, logo_url })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error || !data) {
      await bucket.remove([path]);
      throw new PublicError('Logo update failed.', 503);
    }
    let warning: string | undefined;
    if (business.logo_path) {
      const cleanup = await bucket.remove([business.logo_path]);
      if (cleanup.error)
        warning = 'Logo updated. Remove the previous unused logo in Supabase Storage.';
    }
    return Response.json({ logo_url, warning }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return publicFailure(error);
  }
}
