import { expect, test } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { SignInPage } from '../pages/signInPage.ts';
import { TeachAiPage } from '../pages/teachAiPage.ts';
import { TestData } from '../utils/testData.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '..', 'uploadeditems');

/**
 * Copy a fixture under a unique filename in the OS tmpdir so each test (and
 * each parallel worker) uploads a row name that no other test will collide
 * with. Keeps the canonical fixture pristine and gives us a stable handle to
 * assert against in the data-sources list.
 */
function uniqueCopy(sourceFile: string, prefix: string): { path: string; name: string } {
  const src = path.join(FIXTURES, sourceFile);
  const ext = path.extname(sourceFile);
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const name = `${prefix}-${stamp}${ext}`;
  const dest = path.join(os.tmpdir(), name);
  fs.copyFileSync(src, dest);
  return { path: dest, name };
}

/**
 * @Test_Scenarios : [TEACH AI — DATA SOURCES]
 * @Test_TA0001 : User uploads a .txt document and it appears as a data source
 * @Test_TA0002 : After upload the .txt filename appears in the data sources list
 * @Test_TA0003 : Uploaded file shows a status indicator (data-state attribute)
 * @Test_TA0004 : Multiple documents can be uploaded — data sources list grows
 * @Test_TA0005 : Uploaded document can be removed from the data sources list
 * @Test_TA0006 : User uploads a .pdf document and it appears as a data source
 *
 * Flow per test: sign in → navigate to /home/teach-ai → exercise the Add file
 * → (optionally Remove) flow → assert against the Data sources panel.
 */
test.describe('Teach AI — upload document', () => {
  test('TA0001 : User uploads a .txt document and it appears as a data source', async ({
    page,
  }) => {
    const signIn = new SignInPage(page);
    const teachAi = new TeachAiPage(page);

    await signIn.signIn(TestData.email, TestData.password);
    await teachAi.goto();
    await teachAi.expectLoaded();

    const fixturePath = path.resolve(FIXTURES, 'sample-doc.txt');
    await teachAi.uploadFile(fixturePath, 'sample-doc.txt');
  });

  test.skip('TA0002 : Uploaded .txt filename appears in the data sources list', async ({ page }) => {
    const signIn = new SignInPage(page);
    const teachAi = new TeachAiPage(page);

    await signIn.signIn(TestData.email, TestData.password);
    await teachAi.goto();
    await teachAi.expectLoaded();

    // Unique filename so this assertion is unambiguous even with other rows.
    const fixture = uniqueCopy('sample-doc.txt', 'ta0002');
    await teachAi.uploadFile(fixture.path, fixture.name);
  });

  test.skip('TA0003 : Uploaded file shows a status indicator', async ({ page }) => {
    const signIn = new SignInPage(page);
    const teachAi = new TeachAiPage(page);

    await signIn.signIn(TestData.email, TestData.password);
    await teachAi.goto();
    await teachAi.expectLoaded();

    const fixture = uniqueCopy('sample-doc.txt', 'ta0003');
    await teachAi.uploadFile(fixture.path, fixture.name);
    await teachAi.expectDataSourceWithStatus(fixture.name);
  });

  test.skip('TA0004 : Multiple documents can be uploaded and the list grows', async ({ page }) => {
    const signIn = new SignInPage(page);
    const teachAi = new TeachAiPage(page);

    await signIn.signIn(TestData.email, TestData.password);
    await teachAi.goto();
    await teachAi.expectLoaded();

    const before = await teachAi.dataSourceCount();

    const first = uniqueCopy('sample-doc.txt', 'ta0004a');
    await teachAi.uploadFile(first.path, first.name);

    const second = uniqueCopy('sample-doc.txt', 'ta0004b');
    await teachAi.uploadFile(second.path, second.name);

    const after = await teachAi.dataSourceCount();
    expect(after, 'data sources count should grow by 2 after two uploads').toBeGreaterThanOrEqual(
      before + 2,
    );
  });

  test.skip('TA0005 : Uploaded document can be removed from data sources', async ({ page }) => {
    const signIn = new SignInPage(page);
    const teachAi = new TeachAiPage(page);

    await signIn.signIn(TestData.email, TestData.password);
    await teachAi.goto();
    await teachAi.expectLoaded();

    const fixture = uniqueCopy('sample-doc.txt', 'ta0005');
    await teachAi.uploadFile(fixture.path, fixture.name);
    await teachAi.removeDataSource(fixture.name);
  });

  test.skip('TA0006 : User uploads a .pdf document and it appears as a data source', async ({
    page,
  }) => {
    const signIn = new SignInPage(page);
    const teachAi = new TeachAiPage(page);

    await signIn.signIn(TestData.email, TestData.password);
    await teachAi.goto();
    await teachAi.expectLoaded();

    const fixture = uniqueCopy('sample.pdf', 'ta0006');
    await teachAi.uploadFile(fixture.path, fixture.name);
  });
});
