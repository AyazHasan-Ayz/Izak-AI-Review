import Link from 'next/link';
import { Brand } from '@/components/brand';

export default function Page() {
  return (
    <main className="center-page">
      <Brand />
      <h1 style={{ marginTop: 40 }}>IZAK AI Reviews</h1>
      <p>Scan the QR code or tap the NFC card at your business to share your experience.</p>
      <Link className="text-link" href="/privacy">
        Privacy details
      </Link>
    </main>
  );
}
