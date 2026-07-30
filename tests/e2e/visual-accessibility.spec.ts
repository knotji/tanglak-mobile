import AxeBuilder from '@axe-core/playwright';
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

async function prepareAuthenticatedEmptyState(page: Page): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  await page.addInitScript((storedSession) => {
    window.localStorage.setItem('sb-example-auth-token', JSON.stringify(storedSession));
  }, {
    access_token: fakeJwt(expiresAt),
    refresh_token: 'visual-refresh-token',
    expires_at: expiresAt,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'visual@example.com',
    },
  });

  await page.route(`${SUPABASE_ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/auth/v1/user') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-4000-8000-000000000001',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'visual@example.com',
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

async function waitForPage(page: Page, heading: string): Promise<void> {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await expect(page.locator('ion-spinner:visible')).toHaveCount(0);
}

test('Calm Finance login visual baseline', async ({ page }) => {
  await page.goto('/login');
  await waitForPage(page, 'ตั้งหลัก');
  await expect(page).toHaveScreenshot('login-calm-finance.png', {
    animations: 'disabled',
    fullPage: true,
  });
});

for (const screen of [
  { path: '/tabs/today', heading: 'วันนี้', snapshot: 'today-empty.png' },
  { path: '/tabs/transactions', heading: 'รายการ', snapshot: 'transactions-empty.png' },
  { path: '/tabs/upload', heading: 'สแกนสลิป', snapshot: 'scan-slip.png' },
  { path: '/tabs/more', heading: 'เพิ่มเติม', snapshot: 'more-menu.png' },
  { path: '/budget', heading: 'งบประมาณ', snapshot: 'budget-empty.png' },
  { path: '/overview', heading: 'ภาพรวม', snapshot: 'overview-empty.png' },
]) {
  test(`Calm Finance ${screen.heading} visual baseline`, async ({ page }) => {
    await prepareAuthenticatedEmptyState(page);
    await page.goto(screen.path);
    await waitForPage(page, screen.heading);
    await expect(page).toHaveScreenshot(screen.snapshot, {
      animations: 'disabled',
      fullPage: true,
    });
  });
}

test('core screens meet automated WCAG AA checks and remain usable at large text', async ({ page }) => {
  await prepareAuthenticatedEmptyState(page);

  for (const screen of [
    { path: '/tabs/today', heading: 'วันนี้' },
    { path: '/tabs/upload', heading: 'สแกนสลิป' },
    { path: '/tabs/more', heading: 'เพิ่มเติม' },
    { path: '/budget', heading: 'งบประมาณ' },
  ]) {
    await page.goto(screen.path);
    await waitForPage(page, screen.heading);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations, `${screen.path} accessibility violations`).toEqual([]);

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '20px';
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${screen.path} horizontal overflow at large text`).toBeLessThanOrEqual(1);
  }
});
