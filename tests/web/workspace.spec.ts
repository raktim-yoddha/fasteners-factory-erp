import { expect, test } from '@playwright/test';
test('public landing is separate; solo uses persistent SQLite and enforces a second writer', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'From first enquiry. To final dispatch.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Open your factory' }).click();
  await page.getByRole('button', { name: 'Start locally' }).click();
  await page.getByRole('button', { name: 'Load fictional SAMPLE workspace' }).click();
  await expect(page.getByRole('heading', { name: 'A clear view of your floor.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/shared-overview.png', fullPage: true });
  await page.getByRole('link', { name: 'Stock & stores' }).click();
  await expect(page.getByText('SAMPLE M8 hex bolt', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Start locally' }).click();
  await expect(page.getByRole('heading', { name: 'SAMPLE Factory A', exact: true })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/app');
  await second.getByRole('button', { name: 'Start locally' }).click();
  await expect(second.getByRole('alert')).toContainText('Another tab owns the local writer');
  await second.close();
});
