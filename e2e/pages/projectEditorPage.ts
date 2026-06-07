import { expect, type Page } from '@playwright/test';
import { HelperFunctions } from '../utils/helperFunctions.ts';
import { Selectors } from '../utils/selectors.ts';

/**
 * ProjectEditorPage — the editor at /projects/{uuid}?tab=form.
 * Drives title/question editing and the Publish flow.
 * Extends HelperFunctions; routes every interaction through inherited wrappers.
 */
export class ProjectEditorPage extends HelperFunctions {
  constructor(page: Page) {
    super(page);
  }

  async setTitle(title: string): Promise<void> {
    await this.validateAndFillStrings(Selectors.projectEditor.titleInput, title);
    // Triggers autosave; brief settle for the URL transition from /new to /{uuid}.
    await this.page.locator(Selectors.projectEditor.titleInput).press('Tab');
  }

  /**
   * Open the editor for a given UUID and wait for the title input to render.
   * Used to verify that an edit persisted across a navigation: callers read
   * `getTitleValue()` afterwards.
   */
  async openByUuid(uuid: string): Promise<void> {
    await this.navigateToURL(this.projectEditorPage(uuid));
    await this.assertionValidate(Selectors.projectEditor.titleInput);
  }

  async setQuestionText(question: string): Promise<void> {
    await this.validateAndFillStrings(Selectors.projectEditor.questionTextarea, question);
    await this.page.locator(Selectors.projectEditor.questionTextarea).press('Tab');
  }

  async setRatingLabels(low: string, high: string): Promise<void> {
    await this.validateAndFillStrings(Selectors.projectEditor.lowLabelInput, low);
    await this.validateAndFillStrings(Selectors.projectEditor.highLabelInput, high);
    // Blur so the framework commits the change — autosave only fires when both
    // labels are set AND blurred together with title + question.
    await this.page.locator(Selectors.projectEditor.highLabelInput).press('Tab');
  }

  /**
   * The app autosaves a brand-new project (transitioning the URL from
   * `/projects/new` to `/projects/{uuid}`) only after the four required
   * fields are populated: title, question, low label, high label.
   * Filling any subset is a no-op as far as persistence goes — the warning
   * "Endpoint labels need to be updated" stays in the UI and no UUID
   * appears.
   *
   * Tests that just want a persisted draft (to assert by-UUID navigation,
   * list visibility, or later edits) use this helper to reach the first
   * autosave deterministically. Tests that exercise specific edits run
   * this first and then perform their actual mutation.
   */
  async fillMinimumFieldsForAutosave(
    title: string,
    question = 'Auto-filled question for autosave',
    low = 'low',
    high = 'high',
  ): Promise<void> {
    await this.setTitle(title);
    await this.setQuestionText(question);
    await this.setRatingLabels(low, high);
  }

  /** Wait until project finishes autosaving (URL gets a UUID). */
  async waitForUuid(): Promise<string> {
    await this.page.waitForURL(/\/projects\/[a-f0-9-]{36}/, { timeout: 30_000 });
    const match = this.page.url().match(/\/projects\/([a-f0-9-]{36})/);
    if (!match) throw new Error(`Could not parse project UUID from URL: ${this.page.url()}`);
    return match[1];
  }

  /**
   * Read the current value of the title input (post-autosave). Used after a
   * reload to confirm a persisted edit, or to confirm an empty-title submission
   * was rejected and the previous value still stands.
   */
  async getTitleValue(): Promise<string> {
    await this.assertionValidate(Selectors.projectEditor.titleInput);
    return (await this.page.locator(Selectors.projectEditor.titleInput).inputValue()) ?? '';
  }

  /**
   * Try to clear the title and blur. The app rejects an empty title by
   * reverting the input to its previous value once focus leaves the field —
   * there is no inline error message. Callers verify the revert via
   * `getTitleValue()` after a reload.
   */
  async clearTitle(): Promise<void> {
    await this.validateAndFillStrings(Selectors.projectEditor.titleInput, '');
    // Blur fires the autosave attempt; the app silently drops empties.
    await this.page.locator(Selectors.projectEditor.titleInput).press('Tab');
  }

  /** Click Publish, return the survey URL from the success dialog. */
  async publish(): Promise<string> {
    await this.validateAndClick(Selectors.projectEditor.publishBtn);
    await this.assertionValidate(Selectors.publishDialog.dialog);

    // The button's aria-label contains "shareable"; the URL itself lives in
    // an inner element. Match the text node directly to read the full URL.
    const linkText = this.page.locator(Selectors.publishDialog.shareableLinkText).first();
    await linkText.waitFor({ state: 'visible', timeout: 15_000 });
    const link = (await linkText.textContent())?.trim() ?? '';
    if (!link.startsWith('http')) {
      throw new Error(`Expected publish link to start with http, got: ${link}`);
    }
    return link;
  }

  /**
   * Close the publish-success dialog so the next interaction with the editor
   * is not intercepted by the modal overlay. Used between successive
   * publish-click cycles in re-publish tests.
   */
  async closePublishDialog(): Promise<void> {
    const closeBtn =
      '[role="dialog"]:has-text("Your project has been published") [data-test="close-publish-dialog-button"]';
    await this.validateAndClick(closeBtn);
    await expect(this.page.locator(Selectors.publishDialog.dialog)).toBeHidden();
  }
}
