import { test, expect } from '@playwright/test';
const token = 'a'.repeat(43);
for (const width of [320, 390, 768, 1440]) {
  test(`review flow fits ${width}px without an account`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('https://example.com/izak-test-logo.png', (route) =>
      route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',
          'base64',
        ),
      }),
    );
    await page.route(`**/api/review/${token}/generate`, (route) =>
      route.fulfill({ json: { draft: 'The tea was cold, but the staff were kind.' } }),
    );
    await page.goto(`/r/${token}`);
    await expect(page.getByRole('heading', { name: 'Test Cafe' })).toBeVisible();
    await page.getByRole('button', { name: '2 stars' }).click();
    await page
      .getByRole('textbox', { name: 'What did you try, and how was your experience?' })
      .fill('The tea was cold, but the staff were kind.');
    await page.getByRole('button', { name: 'Generate My Review' }).click();
    const draft = page.getByRole('textbox', { name: 'Your editable review draft' });
    await expect(draft).toHaveValue('The tea was cold, but the staff were kind.');
    await draft.fill('The tea was cold. The staff were kind and helpful.');
    await expect(page.getByRole('button', { name: 'Copy & Open Google Reviews' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
    await expect(page.getByRole('link', { name: /login|sign up|dashboard/i })).toHaveCount(0);
    await page.screenshot({ path: `artifacts/review-${width}.png`, fullPage: true });
  });
}
test('removed account, business configuration and QR APIs are unavailable', async ({ request }) => {
  for (const path of [
    '/login',
    '/signup',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/dashboard',
    '/dashboard/qr',
    '/admin',
    '/admin/clients',
    '/private/clients.json',
    '/private/issued/test-cafe.token',
    '/api/businesses',
    '/api/qr',
  ]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
  for (const path of [
    '/api/signup',
    '/api/businesses',
    '/api/review/event',
    '/api/review/generate',
  ]) {
    expect((await request.post(path, { data: {} })).status(), path).toBe(404);
  }
});
test('inactive and unrecognized tokens cannot generate', async ({ request }) => {
  for (const value of ['b'.repeat(43), 'c'.repeat(43), 'test-cafe']) {
    const response = await request.post(`/api/review/${value}/generate`, {
      headers: { origin: 'http://127.0.0.1:3107' },
      data: { rating: 5, experience: 'Real customer feedback.', language: 'English' },
    });
    expect(response.status()).toBe(404);
  }
});

test('inactive and unrecognized links show an unavailable page', async ({ page }) => {
  for (const value of ['b'.repeat(43), 'c'.repeat(43), 'test-cafe']) {
    await page.goto(`/r/${value}`);
    await expect(page.getByRole('heading', { name: 'This page isn’t available.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate My Review' })).toHaveCount(0);
  }
});
test('active API rejects cross-origin and forged business IDs', async ({ request }) => {
  const input = { rating: 5, experience: 'Real customer feedback.', language: 'English' };
  expect(
    (
      await request.post(`/api/review/${token}/generate`, {
        headers: { origin: 'https://evil.example' },
        data: input,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(`/api/review/${token}/generate`, {
        headers: { origin: 'http://127.0.0.1:3107' },
        data: { ...input, businessId: 'inactive-cafe' },
      })
    ).status(),
  ).toBe(400);
});
test('review response protects token privacy and serializes only selected business', async ({
  request,
}) => {
  const response = await request.get(`/r/${token}`);
  expect(response.headers()['referrer-policy']).toBe('no-referrer');
  expect(response.headers()['cache-control']).toContain('no-store');
  const body = await response.text();
  expect(body).not.toContain('token_hash');
  expect(body).not.toContain('Inactive Cafe');
  expect(body).not.toContain('GROQ_API_KEY');
});
