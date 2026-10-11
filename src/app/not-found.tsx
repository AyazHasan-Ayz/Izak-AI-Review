import Link from 'next/link';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
export default function NotFound() {
  return (
    <main className="center-page">
      <Brand />
      <h1 style={{ marginTop: 40 }}>This page isn’t available.</h1>
      <p>
        The link may be incorrect, or the business may have paused its review page. Please ask the
        business for its current link.
      </p>
      <Button asChild>
        <Link href="/">Back to IZAK</Link>
      </Button>
    </main>
  );
}
