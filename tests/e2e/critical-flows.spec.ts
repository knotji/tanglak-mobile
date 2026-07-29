import { expect, test, type Page } from '@playwright/test';

const SUPABASE_ORIGIN = 'https://example.supabase.co';

function fakeJwt(expiresAt: number): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    aud: 'authenticated',
    exp: expiresAt,
    role: 'authenticated',
    sub: '00000000-0000-4000-8000-000000000001',
  })}.signature`;
}

async function authenticate(page: Page): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: fakeJwt(expiresAt),
    refresh_token: 'e2e-refresh-token',
    expires_at: expiresAt,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'e2e@example.com',
    },
  };

  await page.addInitScript((storedSession) => {
    window.localStorage.setItem('sb-example-auth-token', JSON.stringify(storedSession));
  }, session);
}

test('unauthenticated users are routed to login', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('ตั้งหลัก', { exact: true })).toBeVisible();
  await expect(page.locator('input[placeholder="name@example.com"]')).toBeVisible();
});

test('authenticated user can confirm and delete a transaction', async ({ page }) => {
  await authenticate(page);

  await page.route(`${SUPABASE_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/rest/v1/transactions' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': '0-0/*' },
        body: JSON.stringify([{
          id: 'tx-e2e',
          type: 'expense',
          amount_satang: 12500,
          occurred_at: '2026-07-29T01:00:00.000Z',
          merchant: 'ร้าน E2E',
          category_label: 'อาหาร',
          payment_method: null,
          note: null,
        }]),
      });
      return;
    }

    if (url.pathname === '/functions/v1/delete-transaction' && request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { ok: true } }),
      });
      return;
    }

    if (url.pathname === '/auth/v1/user') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-4000-8000-000000000001',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'e2e@example.com',
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto('/tabs/transactions');
  await expect(page.getByText('ร้าน E2E', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /ร้าน E2E/ }).click();
  await page.getByRole('button', { name: 'ลบรายการนี้' }).click();
  await expect(page.getByText('ลบแล้วกู้คืนไม่ได้')).toBeVisible();
  await page.getByRole('button', { name: 'ลบ', exact: true }).click();

  await expect(page.getByText('ร้าน E2E', { exact: true })).toBeHidden();
});
