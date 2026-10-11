import Link from 'next/link';
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="IZAK AI Reviews home">
      <span className="brand-mark">
        i<span>z</span>
      </span>
      <span>
        IZAK<span className="brand-sub">{compact ? 'AI REVIEWS' : 'AI REVIEWS'}</span>
      </span>
    </Link>
  );
}
