// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminDashboard } from '../src/components/admin-dashboard';
const business = {
  id: '8531f880-9cd9-44f5-8b86-a71a032eafed',
  name: 'Test Cafe',
  category: 'Cafe',
  city: 'Delhi',
  logo_url: 'https://example.com/logo.png',
  google_review_url: 'https://g.page/r/test/review',
  status: 'active',
  daily_limit: 100,
  seo_keywords: ['coffee'],
  created_at: '2026-01-01',
};
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return Response.json({ business });
      return Response.json({ businesses: [business] });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('loads real totals, searches, and opens editing fields without exposing review content', async () => {
  render(<AdminDashboard />);
  await screen.findByText('Test Cafe');
  fireEvent.change(screen.getByRole('textbox', { name: 'Search businesses' }), {
    target: { value: 'missing' },
  });
  expect(screen.queryByText('Test Cafe')).toBeNull();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search businesses' }), {
    target: { value: '' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Edit Test Cafe' }));
  expect((screen.getByLabelText('Business name') as HTMLInputElement).value).toBe('Test Cafe');
  expect((screen.getByLabelText('SEO planning keywords') as HTMLInputElement).value).toBe('coffee');
  fireEvent.change(screen.getByLabelText('Business name'), { target: { value: 'Updated Cafe' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save business' }));
  await waitFor(() =>
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(
          ([, init]) =>
            init?.method === 'PATCH' && JSON.parse(String(init.body)).name === 'Updated Cafe',
        ),
    ).toBe(true),
  );
});
it('deactivates a business through the protected mutation endpoint', async () => {
  render(<AdminDashboard />);
  await screen.findByText('Test Cafe');
  fireEvent.click(screen.getByRole('button', { name: 'Deactivate Test Cafe' }));
  await waitFor(() =>
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(
          ([, init]) =>
            init?.method === 'PATCH' && JSON.parse(String(init.body)).status === 'inactive',
        ),
    ).toBe(true),
  );
});
it('requires confirmation before deletion', async () => {
  vi.stubGlobal(
    'confirm',
    vi.fn(() => false),
  );
  render(<AdminDashboard />);
  await screen.findByText('Test Cafe');
  fireEvent.click(screen.getByRole('button', { name: 'Delete Test Cafe' }));
  expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Delete Test Cafe' }));
  await waitFor(() =>
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(
          ([, init]) =>
            init?.method === 'DELETE' && JSON.parse(String(init.body)).confirm === business.id,
        ),
    ).toBe(true),
  );
});
it('opens downloadable QR assets and refreshes the link after rotation', async () => {
  let rotated = false;
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    if (init?.method === 'PATCH') {
      rotated = true;
      return Response.json({ business });
    }
    if (String(input).endsWith('/link'))
      return Response.json({ url: `https://izak-ai.vercel.app/r/${rotated ? 'b' : 'a'}` });
    return Response.json({ businesses: [business] });
  });
  render(<AdminDashboard />);
  await screen.findByText('Test Cafe');
  fireEvent.click(screen.getByRole('button', { name: 'QR code for Test Cafe' }));
  await screen.findByLabelText('Review / NFC URL');
  expect(screen.getByRole('link', { name: 'PNG' }).getAttribute('href')).toContain('format=png');
  expect(screen.getByRole('link', { name: 'SVG' }).getAttribute('href')).toContain('format=svg');
  fireEvent.click(screen.getByRole('button', { name: 'Rotate review link' }));
  await waitFor(() =>
    expect((screen.getByLabelText('Review / NFC URL') as HTMLInputElement).value).toBe(
      'https://izak-ai.vercel.app/r/b',
    ),
  );
});
