import { test, expect } from '@playwright/test';
import sharp from 'sharp';
for (const width of [320, 390, 1440]) {
  test(`admin login is private and responsive at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
    await expect(page.getByRole('link', { name: /signup|register/i })).toHaveCount(0);
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.getByRole('heading', { name: 'Recover access' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to sign in' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `artifacts/admin-login-${width}.png`, fullPage: true });
  });
}
test('anonymous admin endpoints fail closed without exposing configuration', async ({
  request,
}) => {
  for (const path of [
    '/api/admin/businesses',
    '/api/admin/auth',
    '/api/admin/businesses/8531f880-9cd9-44f5-8b86-a71a032eafed/link',
  ]) {
    const result = await request.get(path);
    expect([401, 503]).toContain(result.status());
    expect(await result.text()).not.toContain('SERVICE_ROLE');
  }
});

test('owner manages businesses in the responsive dashboard (mock Supabase)', async ({ page }) => {
  test.setTimeout(90000);
  await page.route('https://mock-storage.example/**', async (route) => {
    const response = await page.request.get(
      route.request().url().replace('https://mock-storage.example', 'http://127.0.0.1:3108'),
    );
    await route.fulfill({ response });
  });
  await page.goto('/admin/login');
  await page.getByLabel('Email address').fill('owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('test-owner-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const authCookies = (await page.context().cookies()).filter((cookie) =>
    cookie.name.startsWith('sb-'),
  );
  expect(authCookies.length).toBeGreaterThan(0);
  expect(authCookies.every((cookie) => cookie.httpOnly && cookie.sameSite === 'Lax')).toBe(true);
  await page.getByRole('button', { name: 'Add New Business' }).click();
  await page.getByLabel('Business name').fill('Test Studio');
  await page.getByLabel('Category', { exact: true }).fill('Wellness');
  await page.getByLabel('City / location').fill('Mumbai');
  await page.getByLabel('Official Google Review URL').fill('https://g.page/r/test/review');
  await page.getByLabel('SEO planning keywords').fill('wellness, Mumbai');
  await page.getByLabel('Business logo').setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: await sharp({ create: { width: 64, height: 64, channels: 3, background: '#DEC49B' } })
      .png()
      .toBuffer(),
  });
  await page.getByRole('button', { name: 'Save business' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Test Studio', { exact: true })).toBeVisible();
  await expect(page.locator('.business-cell img')).toHaveJSProperty('naturalWidth', 64);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `artifacts/admin-dashboard-${width}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: 'Edit Test Studio' }).click();
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/admin-edit-320.png', fullPage: true });
  await page.getByLabel('Business name').fill('Updated Studio');
  await page.getByRole('button', { name: 'Save business' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Deactivate Updated Studio' }).click();
  await expect(page.getByRole('button', { name: 'Activate Updated Studio' })).toBeVisible();
  await page.getByRole('button', { name: 'QR code for Updated Studio' }).click();
  const oldLink = await page.getByLabel('Review / NFC URL').inputValue();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: 'PNG', exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toMatch(/\.png$/);
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Rotate review link' }).click();
  await expect(page.getByLabel('Review / NFC URL')).not.toHaveValue(oldLink);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Updated Studio' }).click();
  await expect(page.getByText('No businesses yet')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
});
