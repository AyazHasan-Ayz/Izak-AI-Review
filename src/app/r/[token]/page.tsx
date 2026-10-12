import { notFound } from 'next/navigation';
import { publicClient } from '@/lib/clients';
import { resolveClient } from '@/lib/businesses';
import { PublicError } from '@/lib/public-error';
import { ReviewFlow } from '@/components/review-flow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Share your experience', robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let client;
  try {
    client = await resolveClient(token);
  } catch (error) {
    if (error instanceof PublicError && error.status === 404) notFound();
    throw error;
  }
  return (
    <ReviewFlow
      token={token}
      business={publicClient(client)}
      settings={{ language: client.language, products: client.products }}
    />
  );
}
