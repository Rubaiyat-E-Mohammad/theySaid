import { expect, type Page } from '@playwright/test';
import { HelperFunctions } from '../utils/helperFunctions.ts';
import { Selectors } from '../utils/selectors.ts';

/**
 * TeachAiPage — the /home/teach-ai page with Data sources panel.
 * Drives the "Add file" upload flow and assertions on the data-sources list
 * (status, multi-upload, removal).
 *
 * Extends HelperFunctions; routes every interaction through inherited wrappers.
 * The file-chooser API and read-only `count()` / `getAttribute()` calls go
 * through the page object directly — these have no equivalent in
 * HelperFunctions and are not actions in the usual sense.
 */
export class TeachAiPage extends HelperFunctions {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.navigateToURL(this.teachAiPage);
    // Dismiss the cookie banner if present (parallel workers can race here).
    const cookieVisible = await this.page.locator(Selectors.app.cookieRejectAll)
      .isVisible()
      .catch(() => false);
    if (cookieVisible) {
      await this.validateAndClick(Selectors.app.cookieRejectAll);
    }
  }

  async expectLoaded(): Promise<void> {
    await this.assertionValidate(Selectors.teachAi.heading);
    await this.assertionValidate(Selectors.teachAi.dataSourcesSection);
  }

  /**
   * Drive the Add-file upload pane end-to-end and assert that the file ends
   * up in the data-sources panel.
   *
   * UI sequence:
   *   1. Click "Add file" → upload pane opens.
   *   2. Click the dropzone ("Click to upload") → native file chooser opens.
   *      We trigger the chooser via the dropzone (not `setInputFiles` on the
   *      hidden input) because the React state machine reacts to the chooser
   *      flow — direct input writes upload to GCS but do not always propagate
   *      the post-upload state that adds the row to the list.
   *   3. Set the file on the chooser → filename appears in the staging area
   *      and the action button label flips "Confirm" → "Save".
   *   4. Click Save → bytes upload to GCS (PUT to storage.googleapis.com),
   *      the staging pane closes, and the row appears in the Data sources
   *      list.
   *
   * `setInputFiles` / `setFiles` / `waitForEvent('filechooser')` are the
   * canonical Playwright APIs for file uploads and have no equivalent in
   * HelperFunctions.
   */
  async uploadFile(absolutePath: string, displayName: string): Promise<void> {
    await this.validateAndClick(Selectors.teachAi.addFileBtn);

    const chooserPromise = this.page.waitForEvent('filechooser', { timeout: 10_000 });
    await this.validateAndClick(Selectors.teachAi.addFileDropzone);
    const chooser = await chooserPromise;
    await chooser.setFiles(absolutePath);

    // Filename should appear in the staging area before we can save.
    await expect(this.page.getByText(displayName, { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Wait for the upload XHR to complete so the assertion below isn't racing
    // the GCS PUT.
    const gcsResponse = this.page
      .waitForResponse(
        (r) =>
          r.request().method() === 'PUT' &&
          r.url().includes('storage.googleapis.com') &&
          r.status() < 400,
        { timeout: 30_000 },
      )
      .catch(() => null);
    await this.validateAndClick(Selectors.teachAi.saveBtnEnabled);
    await gcsResponse;

    // Wait for the staging pane to close — the most reliable observable
    // signal that Save succeeded, independent of whether the data-sources
    // list refetch fires.
    await expect(this.page.locator(Selectors.teachAi.addFileContainer)).toHaveCount(0, {
      timeout: 30_000,
    });
    console.log('\x1b[34m%s\x1b[0m', `✅ Upload staging closed for "${displayName}"`);
  }

  /**
   * Assert that the data-sources list contains a row with the given title.
   * Use this AFTER `uploadFile` to verify the row landed in the list.
   */
  async expectDataSource(displayName: string): Promise<void> {
    await this.assertionValidate(Selectors.teachAi.dataSourceItemByTitle(displayName));
  }

  /**
   * Count of items currently in the data-sources list.
   * Read-only; used to assert that uploading grows the list.
   */
  async dataSourceCount(): Promise<number> {
    return this.page.locator(Selectors.teachAi.dataSourceItem).count();
  }

  /**
   * Assert that the named data source exposes a non-empty `data-state`
   * attribute (the app's status indicator — observed values: `idle` for
   * ready, plus `uploading` / `processing` / `error` during async work).
   * We only check that *some* status is set so the test stays stable across
   * backend timing.
   */
  async expectDataSourceWithStatus(displayName: string): Promise<void> {
    const row = this.page.locator(Selectors.teachAi.dataSourceItemByTitle(displayName));
    await row.waitFor({ state: 'visible', timeout: 30_000 });
    const state = await row.getAttribute('data-state');
    expect(state, `data-source row "${displayName}" should expose a data-state`).not.toBeNull();
    expect(state).not.toBe('');
    console.log('\x1b[34m%s\x1b[0m', `✅ Data source "${displayName}" has status="${state}"`);
  }

  /**
   * Remove a data source via the row's kebab menu → Remove action → confirm.
   * The app pops a "Remove file" / "Remove link" confirmation dialog whose
   * Remove button actually fires the delete — two clicks total. Asserts the
   * row count drops to zero for that title afterwards.
   */
  async removeDataSource(displayName: string): Promise<void> {
    await this.assertionValidate(Selectors.teachAi.dataSourceItemByTitle(displayName));
    await this.validateAndClick(Selectors.teachAi.dataSourceMenuByTitle(displayName));
    await this.validateAndClick(Selectors.teachAi.dataSourceMenuRemove);

    // Confirmation dialog — second click commits the deletion.
    await this.assertionValidate(Selectors.teachAi.removeConfirmDialog);
    await this.validateAndClick(Selectors.teachAi.removeConfirmBtn);

    // The row should disappear from the list.
    await expect(
      this.page.locator(Selectors.teachAi.dataSourceItemByTitle(displayName)),
    ).toHaveCount(0, { timeout: 30_000 });
    console.log('\x1b[34m%s\x1b[0m', `✅ Data source "${displayName}" removed`);
  }
}
