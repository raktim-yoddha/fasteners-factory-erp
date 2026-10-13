import { expect, test } from '@playwright/test';

const actorA = '10000000-0000-4000-8000-000000000001';
const actorB = '10000000-0000-4000-8000-000000000002';
const journalKey = `fasteners-company-setup:v1:${encodeURIComponent('https://sample-backend.invalid')}:${actorA}`;
const entry = '/tests/company-setup.html';

test('SAMPLE company setup retains lost confirmation, isolates identity and distinguishes failed refresh', async ({
  page,
}) => {
  await page.goto(entry);
  await page.getByRole('button', { name: 'Open team workspace' }).click();
  await page.getByLabel('Company name').fill('SAMPLE Recovery Factory');
  await page.screenshot({ path: 'test-results/company-setup.png', fullPage: true });
  await page.getByRole('button', { name: 'Create company atomically' }).click();
  await expect(
    page.getByText('Confirmation unknown — original company setup retained.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '← Change mode', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Open workspace' })).toBeDisabled();
  const original = await page.evaluate((key) => localStorage.getItem(key), journalKey);
  expect(original).not.toBeNull();
  await page.reload();
  await page.getByRole('button', { name: 'Open team workspace' }).click();
  await expect(
    page.getByText('SAMPLE Recovery Factory · Main plant · Main warehouse'),
  ).toBeVisible();
  await expect(page.getByLabel('Company name')).toHaveCount(0);

  await page.evaluate((actor) => localStorage.setItem('sample-fixture-actor', actor), actorB);
  await page.reload();
  await page.getByRole('button', { name: 'Open team workspace' }).click();
  await expect(page.getByRole('button', { name: 'Create company atomically' })).toBeEnabled();
  await expect(page.getByText('SAMPLE Recovery Factory · Main plant · Main warehouse')).toHaveCount(
    0,
  );
  expect(await page.evaluate((key) => localStorage.getItem(key), journalKey)).toBe(original);
  await page.evaluate((actor) => localStorage.setItem('sample-fixture-actor', actor), actorA);
  await page.reload();
  await page.getByRole('button', { name: 'Open team workspace' }).click();
  await page.evaluate(() => localStorage.setItem('sample-fixture-refresh-fail', 'true'));
  await page.getByRole('button', { name: 'Retry original company setup' }).click();
  await expect(page.getByText(/^Company committed: /)).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(
    'Company committed. Company list refresh failed',
  );
  expect(await page.evaluate((key) => localStorage.getItem(key), journalKey)).toBeNull();
  const evidence = (await page.evaluate(() => ({
    attempts: JSON.parse(localStorage.getItem('sample-fixture-attempts')!),
    commits: JSON.parse(localStorage.getItem('sample-fixture-commits')!),
  }))) as { attempts: unknown[]; commits: unknown[] };
  expect(evidence.attempts).toHaveLength(2);
  expect(evidence.attempts[0]).toEqual(evidence.attempts[1]);
  expect(evidence.commits).toHaveLength(1);
  await page.evaluate(() => localStorage.removeItem('sample-fixture-refresh-fail'));
  await page.getByRole('button', { name: 'Refresh company list' }).click();
  await expect(
    page.getByRole('heading', { name: 'SAMPLE Recovery Factory', exact: true }),
  ).toBeVisible();
});

test('SAMPLE company setup blocks corrupt journals and a real competing browser writer lock', async ({
  page,
  context,
}) => {
  await page.goto(entry);
  await page.evaluate((key) => localStorage.setItem(key, '{invalid'), journalKey);
  await page.getByRole('button', { name: 'Open team workspace' }).click();
  await expect(page.getByRole('alert')).toContainText('Preserve it for recovery');
  await expect(page.getByRole('button', { name: 'Create company atomically' })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('sample-fixture-attempts'))).toBeNull();
  await page.evaluate((key) => localStorage.removeItem(key), journalKey);
  await page.getByRole('button', { name: 'Recheck company request storage' }).click();
  await expect(page.getByRole('button', { name: 'Create company atomically' })).toBeEnabled();
  const holder = await context.newPage();
  await holder.goto(entry);
  await holder.evaluate((key) => {
    void navigator.locks.request(key, async () => {
      document.body.dataset.lockHeld = 'true';
      await new Promise<void>(() => {
        /* Hold until this test window closes. */
      });
    });
  }, journalKey);
  await expect(holder.locator('body')).toHaveAttribute('data-lock-held', 'true');
  await page.getByLabel('Company name').fill('SAMPLE Competing Factory');
  await page.getByRole('button', { name: 'Create company atomically' }).click();
  await expect(page.getByRole('alert')).toContainText('Another window is submitting company setup');
  expect(await page.evaluate(() => localStorage.getItem('sample-fixture-attempts'))).toBeNull();
  await holder.close();
});
