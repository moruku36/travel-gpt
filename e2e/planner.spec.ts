import { expect, test, type Page } from '@playwright/test';

async function setUpKyoto(page: Page) {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: '旅の設定' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('行き先', { exact: false }).fill('京都');
  await dialog.getByLabel('出発日').fill('2026-11-20');
  await dialog.getByLabel('最終日').fill('2026-11-21');
  await dialog.getByRole('button', { name: '閉じる' }).click();
  await expect(dialog).toBeHidden();
}

async function openTab(page: Page, name: '旅程' | 'ふたりで' | 'チャット', isMobile: boolean) {
  if (isMobile) await page.getByRole('navigation', { name: '表示切替' }).getByRole('button', { name }).click();
  else if (name !== 'チャット') await page.getByRole('tab', { name, exact: true }).click();
}

async function askAndApply(page: Page) {
  const box = page.getByRole('textbox', { name: 'メッセージ' });
  await box.fill('京都で紅葉と寺を巡りたい');
  await box.press('Enter');
  await expect(page.getByText('デモモード', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: '旅程に適用' }).click();
  await expect(page.getByText('適用済み', { exact: false })).toBeVisible();
}

test('chat proposal → itinerary, undo/redo, reload keeps the plan', async ({ page, isMobile }) => {
  await setUpKyoto(page);
  await askAndApply(page);

  await openTab(page, '旅程', isMobile);
  const stops = page.locator('ol.stops > li.stop');
  await expect(stops).toHaveCount(4);
  await expect(stops.first()).toContainText('伏見稲荷大社');
  await expect(stops.first()).toContainText('09:30');

  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(stops).toHaveCount(0);
  await page.getByRole('button', { name: 'やり直す' }).click();
  await expect(stops).toHaveCount(4);

  await page.reload();
  await openTab(page, '旅程', isMobile);
  await page.getByRole('tab', { name: '1日目' }).click();
  await expect(page.locator('ol.stops > li.stop')).toHaveCount(4);
});

test('split plan, shared condition and the printable booklet', async ({ page, isMobile }) => {
  await setUpKyoto(page);
  await askAndApply(page);
  await openTab(page, '旅程', isMobile);

  // second stop: only "わたし" goes → split plan
  const second = page.locator('ol.stops > li.stop').nth(1);
  await second.getByRole('button', { name: '詳細を編集' }).click();
  await second.getByRole('button', { name: 'パートナー' }).click();
  await expect(second).toHaveClass(/branch/);
  await expect(page.getByText('ここで全員合流')).toBeVisible();

  await openTab(page, 'ふたりで', isMobile);
  await page.getByRole('combobox', { name: '条件の種類' }).selectOption('max-walk-km');
  await page.getByPlaceholder('数値（km）').fill('3');
  await page.getByRole('combobox', { name: '強さ' }).selectOption('required');
  await page.getByRole('button', { name: '追加', exact: true }).click();
  await expect(page.locator('.prefs')).toContainText('1日の徒歩上限');

  await page.goto('/print');
  await expect(page.getByRole('heading', { name: /1日目/ })).toBeVisible();
  await expect(page.getByText('伏見稲荷大社')).toBeVisible();
  await expect(page.getByText('1日の徒歩上限', { exact: false })).toBeVisible();
});

test('destination discovery puts worldwide candidates on the map', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('dialog', { name: '旅の設定' }).getByRole('button', { name: '閉じる' }).click();
  await page.getByRole('tab', { name: '行き先探し' }).click();
  const box = page.getByRole('textbox', { name: 'メッセージ' });
  await box.fill('どこか行きたい');
  await box.press('Enter');
  await expect(page.locator('.place-chip', { hasText: 'パリ' })).toBeVisible();
  await page.locator('.place-chip', { hasText: '金沢' }).click();
  await page.getByRole('button', { name: /ここに決める/ }).click();
  await expect(page.locator('.brand-text')).toContainText('金沢');
});

test('API rejects invalid chat input and reports demo mode', async ({ request }) => {
  const bad = await request.post('/api/chat', { data: { messages: [] } });
  expect(bad.status()).toBe(400);
  const body = await bad.json();
  expect(body.error.code).toBe('invalid_request');
  const health = await request.get('/api/health');
  expect((await health.json()).llm).toBe('demo');
});
