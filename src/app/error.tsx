'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="center-page">
      <span className="eyebrow">IZAK AI REVIEWS</span>
      <h1 style={{ marginTop: 20 }}>A brief interruption.</h1>
      <p>
        We couldn’t load this page. Please try again, or ask the business for its Google review
        link.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
