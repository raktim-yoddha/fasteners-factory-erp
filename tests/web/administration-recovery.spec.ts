import { expect, test, type Page } from '@playwright/test';

const actor = '10000000-0000-4000-8000-000000000001';
const key = `fasteners-administration:v1:${encodeURIComponent('https://sample-backend.invalid')}:${actor}`;
const entry = '/tests/company-setup.html?administration=true';
async function openSettings(page: Page) {
  await page.goto(entry);
  await page.getByRole('button', { name: 'Open team workspace' }).click();
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await page.getByRole('link', { name: 'Workspace settings' }).click();
  await expect(
    page.getByRole('heading', { name: 'The right people. The right access.' }),
  ).toBeVisible();
}
test('SAMPLE invitation recovery survives restart and membership revocation without persisting its returned token', async ({
  page,
}) => {
  await openSettings(page);
  await page.getByLabel('Intended email').fill('sample-invite@example.invalid');
  await page.getByRole('checkbox', { name: 'Stores', exact: true }).check();
  await page.getByRole('checkbox', { name: 'All plants', exact: true }).check();
  await page.getByRole('button', { name: 'Create verified-email invitation' }).click();
  await expect(
    page.getByRole('heading', { name: 'Administration confirmation unknown' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change mode', exact: true })).toBeDisabled();
  const original = await page.evaluate((name) => localStorage.getItem(name), key);
  expect(original).toContain('sample-invite@example.invalid');
  expect(original).not.toContain('SAMPLE-invitation');
  await page.evaluate(() => localStorage.setItem('sample-admin-revoked', 'true'));
  await page.reload();
  await page.getByRole('button', { name: 'Open team workspace' }).click();
  await expect(page.getByRole('button', { name: 'Open workspace' })).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Administration confirmation unknown' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry original administration request' }).click();
  await expect(page.getByRole('alert').first()).toContainText(
    'Administration confirmation unknown',
  );
  expect(await page.evaluate((name) => localStorage.getItem(name), key)).toBe(original);
  await page.evaluate(() => localStorage.removeItem('sample-admin-revoked'));
  await page.getByRole('button', { name: 'Retry original administration request' }).click();
  await expect(page.getByText(/Give the intended member this single-use token/)).toBeVisible();
  expect(await page.evaluate((name) => localStorage.getItem(name), key)).toBeNull();
  const evidence = (await page.evaluate(() => ({
    attempts: JSON.parse(localStorage.getItem('sample-admin-attempts')!),
    commits: JSON.parse(localStorage.getItem('sample-admin-commits')!),
  }))) as { attempts: unknown[]; commits: unknown[] };
  expect(evidence.attempts).toHaveLength(3);
  expect(evidence.attempts[0]).toEqual(evidence.attempts[1]);
  expect(evidence.attempts[1]).toEqual(evidence.attempts[2]);
  expect(evidence.commits).toHaveLength(1);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText(/Give the intended member this single-use token/)).toHaveCount(0);
});

for (const operation of ['plant', 'access'] as const) {
  test(`SAMPLE ${operation} change retries its original fields after process-page restart`, async ({
    page,
  }) => {
    await openSettings(page);
    if (operation === 'plant') {
      await page.getByLabel('New plant name').fill('SAMPLE New Plant');
      await page.getByLabel('Initial warehouse', { exact: true }).fill('SAMPLE New Warehouse');
      await page.getByRole('button', { name: 'Create plant atomically' }).click();
    } else {
      await page
        .getByRole('row')
        .filter({ hasText: 'sample-member@example.invalid' })
        .getByRole('button', { name: 'Edit access' })
        .click();
      await page.getByRole('dialog').getByRole('checkbox', { name: 'Membership active' }).uncheck();
      await page.getByRole('button', { name: 'Apply current access' }).click();
    }
    await expect(
      page.getByRole('heading', { name: 'Administration confirmation unknown' }),
    ).toBeVisible();
    const original = await page.evaluate((name) => localStorage.getItem(name), key);
    await page.reload();
    await page.getByRole('button', { name: 'Open team workspace' }).click();
    await expect(page.getByRole('button', { name: 'Open workspace' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Create company atomically' })).toBeDisabled();
    expect(await page.evaluate((name) => localStorage.getItem(name), key)).toBe(original);
    await page.getByRole('button', { name: 'Retry original administration request' }).click();
    await expect(
      page.getByRole('heading', { name: 'Administration committed', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate((name) => localStorage.getItem(name), key)).toBeNull();
    const attempts = (await page.evaluate(() =>
      JSON.parse(localStorage.getItem('sample-admin-attempts')!),
    )) as unknown[];
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toEqual(attempts[1]);
  });
}
test('SAMPLE corrupted administration storage blocks both picker navigation and new company creation', async ({
  page,
}) => {
  await page.goto(entry);
  await page.evaluate((name) => localStorage.setItem(name, '{invalid'), key);
  await page.getByRole('button', { name: 'Open team workspace' }).click();
  await expect(page.getByRole('alert')).toContainText('Preserve it for recovery');
  await expect(page.getByRole('button', { name: 'Open workspace' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Create company atomically' })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('sample-admin-attempts'))).toBeNull();
  await page.evaluate((name) => localStorage.removeItem(name), key);
  await page.getByRole('button', { name: 'Recheck administration storage' }).click();
  await expect(page.getByRole('button', { name: 'Open workspace' })).toBeEnabled();
});

test('SAMPLE quota failure sends nothing and disables administration until storage is rechecked', async ({
  page,
}) => {
  await openSettings(page);
  await page.evaluate(() => localStorage.setItem('sample-admin-quota', 'true'));
  await page.getByLabel('New plant name').fill('SAMPLE Quota Plant');
  await page.getByLabel('Initial warehouse', { exact: true }).fill('SAMPLE Quota Stores');
  await page.getByRole('button', { name: 'Create plant atomically' }).click();
  await expect(page.getByRole('button', { name: 'Create plant atomically' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Recheck administration storage' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sample-admin-attempts'))).toBeNull();
  await page.evaluate(() => localStorage.removeItem('sample-admin-quota'));
  await page.getByRole('button', { name: 'Recheck administration storage' }).click();
  await expect(page.getByRole('button', { name: 'Create plant atomically' })).toBeEnabled();
});
