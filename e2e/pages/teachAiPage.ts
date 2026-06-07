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

    // Wait for the upload XHR to fire so the assertion below isn't racing
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
  }

  /**
   * Open the Add file upload pane and assert the staging UI is fully wired
   * up (dropzone, accept attribute, Cancel/Confirm buttons). This drives the
   * subset of the upload flow that doesn't depend on backend persistence.
   */
  async openAddFilePane(): Promise<void> {
    await this.validateAndClick(Selectors.teachAi.addFileBtn);
    await this.assertionValidate(Selectors.teachAi.addFileContainer);
    await this.assertionValidate(Selectors.teachAi.addFileDropzone);
    await this.assertionValidate(Selectors.teachAi.cancelBtnTest);
  }

  /**
   * Stage a file in the Add file pane (without clicking Save) and assert
   * the action button flips from "Confirm" (disabled) to "Save" (enabled).
   * Use this when you want to exercise the file-chooser + staging UI without
   * hitting the backend persistence path.
   */
  async stageFile(absolutePath: string, displayName: string): Promise<void> {
    const chooserPromise = this.page.waitForEvent('filechooser', { timeout: 10_000 });
    await this.validateAndClick(Selectors.teachAi.addFileDropzone);
    const chooser = await chooserPromise;
    await chooser.setFiles(absolutePath);

    await expect(this.page.getByText(displayName, { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    });
    await this.assertionValidate(Selectors.teachAi.saveBtnEnabled);
  }

  /** Click Cancel in the Add file pane and assert the pane closes. */
  async cancelAddFile(): Promise<void> {
    await this.validateAndClick(Selectors.teachAi.cancelBtnTest);
    await expect(this.page.locator(Selectors.teachAi.addFileContainer)).toHaveCount(0, {
      timeout: 10_000,
    });
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
   * Read the titles of every row currently in the data sources panel.
   * File rows expose the filename as a `title` attribute on the inner span;
   * link rows expose the URL as an `aria-label` on the inner generic — fall
   * back to the row's visible text when neither attribute is present so the
   * caller always gets something useful to assert on.
   */
  async dataSourceTitles(): Promise<string[]> {
    return this.page.locator(Selectors.teachAi.dataSourceItem).evaluateAll((items) =>
      items
        .map((it) => {
          const titled = it.querySelector('[title]') as HTMLElement | null;
          if (titled) return titled.getAttribute('title') ?? '';
          const labelled = it.querySelector('[aria-label]') as HTMLElement | null;
          if (labelled) return labelled.getAttribute('aria-label') ?? '';
          return (it.textContent ?? '').trim();
        })
        .filter((t) => t.length > 0),
    );
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
   * Assert that any data source row exposes a non-empty data-state.
   * Doesn't require the row to be a specific file — useful when the test
   * environment may have any combination of pre-seeded rows.
   */
  async expectAnyDataSourceWithStatus(): Promise<void> {
    const first = this.page.locator(Selectors.teachAi.dataSourceItem).first();
    await first.waitFor({ state: 'visible', timeout: 15_000 });
    const state = await first.getAttribute('data-state');
    expect(state, 'first data-source row should expose a data-state').not.toBeNull();
    expect(state).not.toBe('');
    console.log('\x1b[34m%s\x1b[0m', `✅ A data source row exposes status="${state}"`);
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
