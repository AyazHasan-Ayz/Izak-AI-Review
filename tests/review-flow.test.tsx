// @vitest-environment jsdom
import React from 'react';
import { afterEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ReviewFlow } from '../src/components/review-flow';
const business = {
  name: 'Test business',
  category: 'Cafe',
  city: 'Mumbai',
  logo_url: '',
  description: '',
  google_review_url: 'https://g.page/r/test/review',
};
const settings = { language: 'English' as const, products: ['Tea'] };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
for (const rating of [1, 2, 3, 4, 5])
  it(`shows the same Google link for ${rating} stars, without automatic navigation`, () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: true })));
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<ReviewFlow token={'a'.repeat(43)} business={business} settings={settings} />);
    fireEvent.click(
      screen.getByRole('button', { name: `${rating} star${rating === 1 ? '' : 's'}` }),
    );
    expect(screen.getByRole('link', { name: 'Open Google Reviews' }).getAttribute('href')).toBe(
      business.google_review_url,
    );
    expect(open).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
it('generates, edits and offers a manual clipboard fallback without posting anything', async () => {
  const fetcher = vi
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(
        Response.json(
          url.endsWith('/generate')
            ? { draft: 'The tea was good, but service was slow.' }
            : { ok: true },
        ),
      ),
    );
  vi.stubGlobal('fetch', fetcher);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
  });
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  render(<ReviewFlow token={'a'.repeat(43)} business={business} settings={settings} />);
  fireEvent.click(screen.getByRole('button', { name: '2 stars' }));
  fireEvent.change(
    screen.getByRole('textbox', { name: 'What did you try, and how was your experience?' }),
    { target: { value: 'The tea was good, but service was slow.' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Generate My Review' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Your editable review draft' })).toBeTruthy(),
  );
  const edited = 'The tea was lovely. Service could be quicker.';
  fireEvent.change(screen.getByRole('textbox', { name: 'Your editable review draft' }), {
    target: { value: edited },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Copy Review' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Select text for manual copying' })).toBeTruthy(),
  );
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(edited);
  expect(open).not.toHaveBeenCalled();
  expect(fetcher.mock.calls.every(([url]) => String(url).startsWith('/api/review/'))).toBe(true);
});

it('copies the edited draft and opens the configured Google URL without posting a review', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ draft: 'The tea was cold.' }));
  vi.stubGlobal('fetch', fetcher);
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const popup = { opener: {}, location: { replace: vi.fn() }, close: vi.fn() };
  const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
  render(<ReviewFlow token={'a'.repeat(43)} business={business} settings={settings} />);
  fireEvent.click(screen.getByRole('button', { name: '1 star' }));
  fireEvent.change(
    screen.getByRole('textbox', { name: 'What did you try, and how was your experience?' }),
    { target: { value: 'The tea was cold.' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Generate My Review' }));
  const draft = await screen.findByRole('textbox', { name: 'Your editable review draft' });
  fireEvent.change(draft, { target: { value: 'The tea arrived cold.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Copy & Open Google Reviews' }));
  await waitFor(() =>
    expect(popup.location.replace).toHaveBeenCalledWith(business.google_review_url),
  );
  expect(writeText).toHaveBeenCalledWith('The tea arrived cold.');
  expect(open).toHaveBeenCalledWith('about:blank', '_blank');
  expect(popup.opener).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('handles a hosting rate-limit HTML response without showing parser errors', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('<html>Blocked</html>', { status: 429 })),
  );
  render(<ReviewFlow token={'a'.repeat(43)} business={business} settings={settings} />);
  fireEvent.click(screen.getByRole('button', { name: '3 stars' }));
  fireEvent.change(
    screen.getByRole('textbox', { name: 'What did you try, and how was your experience?' }),
    { target: { value: 'The tea was fine.' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Generate My Review' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Please wait');
  expect(screen.getByRole('link', { name: 'Open Google Reviews' })).toBeTruthy();
});
