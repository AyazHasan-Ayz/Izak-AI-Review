'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  Star,
  Sparkles,
  ArrowUpRight,
  Copy,
  RefreshCw,
  Check,
  Loader2,
  PencilLine,
} from 'lucide-react';
import type { Business, BusinessSettings } from '@/lib/types';
import { Brand } from './brand';
import { Button } from './ui/button';
export function ReviewFlow({
  business,
  settings,
  token,
}: {
  business: Business;
  token: string;
  settings: Pick<BusinessSettings, 'language' | 'products'>;
}) {
  const [rating, setRating] = useState(0);
  const [experience, setExperience] = useState('');
  const [language, setLanguage] = useState(settings.language);
  const [product, setProduct] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [website, setWebsite] = useState('');
  const [manual, setManual] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  async function generate() {
    if (busy) return;
    setError('');
    setMessage('');
    if (!rating) {
      setError('Choose a rating to tell us how it went.');
      return;
    }
    if (experience.trim().length < 10) {
      setError('Please share a little more about your experience (at least 10 characters).');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/review/${encodeURIComponent(token)}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          experience,
          language,
          product: product || undefined,
          website,
        }),
        signal: AbortSignal.timeout(50000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          result?.error ||
            (response.status === 429
              ? 'Please wait before trying again. You can still write your review on Google.'
              : 'Drafting is temporarily unavailable. Refresh the page and try again.'),
        );
      if (typeof result?.draft !== 'string' || !result.draft.trim())
        throw new Error('The draft could not be completed. Please try again.');
      setDraft(result.draft);
      setAttempts((a) => a + 1);
      setTimeout(() => draftRef.current?.focus(), 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again shortly.');
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setManual(false);
      setMessage(
        'Copied. Paste this into Google, choose your rating, and submit when you’re ready.',
      );
      return true;
    } catch {
      setManual(true);
      setMessage(
        'Automatic copying is unavailable. Select the review text below and copy it manually.',
      );
      draftRef.current?.focus();
      draftRef.current?.select();
      return false;
    }
  }
  function copyAndOpen() {
    // Open synchronously during the tap so mobile popup blockers do not swallow the action.
    const win = window.open('about:blank', '_blank');
    if (win) win.opener = null;
    void copy().then((copied) => {
      if (copied) {
        if (win) {
          win.location.replace(business.google_review_url);
        } else setMessage('Review copied. Tap “Open Google Reviews” below to continue.');
      } else {
        win?.close();
      }
    });
  }
  return (
    <main className="review-page">
      <div className="review-wrap">
        <div className="review-brand">
          <Brand compact />
        </div>
        <header className="review-header">
          {business.logo_url ? (
            <img
              className="business-logo"
              src={business.logo_url}
              alt={`${business.name} logo`}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="monogram">{business.name.slice(0, 1)}</div>
          )}
          <h1>{business.name}</h1>
          <p>{[business.category, business.city].filter(Boolean).join(' · ')}</p>
          {business.description && <p>{business.description}</p>}
        </header>
        <section className="review-card">
          <div className="step-line">
            YOUR EXPERIENCE <span /> {draft ? '02 / YOUR REVIEW' : '01 / YOUR THOUGHTS'}
          </div>
          <h2>{draft ? 'Your words, refined.' : 'How was your experience?'}</h2>
          <p>
            {draft
              ? 'Make it yours. You’re always in control of the final words.'
              : 'A few honest words can make a real difference.'}
          </p>
          <div className="stars" role="group" aria-label="Choose your rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                className={n <= rating ? 'chosen' : ''}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                aria-pressed={rating === n}
                onClick={() => setRating(n)}
              >
                <Star size={34} fill={n <= rating ? 'currentColor' : 'none'} strokeWidth={1.3} />
              </button>
            ))}
          </div>
          <div className="rating-caption" aria-live="polite">
            {
              [
                'Choose the rating that feels right',
                'Very disappointing',
                'Could have been better',
                'It was okay',
                'A good experience',
                'A wonderful experience',
              ][rating]
            }
          </div>
          <label className="field">
            <span id="experience-label">What did you try, and how was your experience?</span>
            <textarea
              aria-labelledby="experience-label"
              aria-describedby="experience-help"
              rows={4}
              maxLength={1500}
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="Tell us what stood out, or what could have been better…"
            />
            <small id="experience-help">
              {experience.length}/1500 · Please leave out personal or sensitive details.
            </small>
          </label>
          {settings.products.length > 0 && (
            <label className="field">
              <span>Product or service (optional)</span>
              <select value={product} onChange={(e) => setProduct(e.target.value)}>
                <option value="">Choose an option</option>
                {settings.products.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>Review language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
            >
              <option>English</option>
              <option>Hindi</option>
              <option>Hinglish</option>
            </select>
          </label>
          <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px' }}>
            <label>
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          {!draft ? (
            <Button onClick={generate} disabled={busy}>
              {busy ? <Loader2 size={17} className="spin" /> : <Sparkles size={17} />}{' '}
              {busy ? 'Finding your words…' : 'Generate My Review'}
            </Button>
          ) : (
            <>
              <label className="field">
                <span>Your editable review draft</span>
                <textarea
                  ref={draftRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={6}
                  maxLength={2500}
                />
              </label>
              <Button
                variant="ghost"
                onClick={() => {
                  draftRef.current?.focus();
                  draftRef.current?.select();
                }}
              >
                <PencilLine size={16} />
                Edit Review
              </Button>
              <Button onClick={copyAndOpen} disabled={!draft.trim()}>
                <Copy size={16} />
                Copy & Open Google Reviews <ArrowUpRight size={16} />
              </Button>
              <Button variant="outline" onClick={() => void copy()} disabled={!draft.trim()}>
                <Copy size={15} />
                Copy Review
              </Button>
              <Button variant="ghost" onClick={generate} disabled={busy || attempts >= 3}>
                {busy ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}{' '}
                {busy
                  ? 'Refining your draft…'
                  : attempts >= 3
                    ? 'Drafting limit reached'
                    : 'Regenerate Review'}
              </Button>
              {message && (
                <p role="status" className="notice">
                  <Check size={16} />
                  {message}
                </p>
              )}
              {manual && (
                <Button
                  variant="outline"
                  onClick={() => {
                    draftRef.current?.focus();
                    draftRef.current?.select();
                  }}
                >
                  Select text for manual copying
                </Button>
              )}
            </>
          )}
        </section>
        <div className="review-disclosure">
          AI helps express your experience; it can make mistakes. Please check every detail. Your
          feedback is sent to Groq for drafting. IZAK does not save your feedback or review.{' '}
          <Link className="text-link" href="/privacy">
            Privacy details
          </Link>
        </div>
        <div className="google-direct">
          <a href={business.google_review_url} target="_blank" rel="noopener noreferrer">
            Open Google Reviews <ArrowUpRight size={15} />
          </a>
          <p style={{ fontSize: 10 }}>
            Available for every rating. Choose your stars and submit your review on Google yourself.
          </p>
        </div>
        <footer className="review-footer">
          SMARTER REVIEWS. STRONGER REPUTATION.
          <br />
          <Link href="/">Powered by IZAK</Link>
        </footer>
      </div>
    </main>
  );
}
