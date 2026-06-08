import { expect, type Page } from '@playwright/test';
import { HelperFunctions } from '../utils/helperFunctions.ts';
import { Selectors } from '../utils/selectors.ts';

/**
 * SurveyTakerPage — the public survey URL at /survey/project/{uuid}.
 * Lets us submit an answer and confirm the thank-you state.
 * Extends HelperFunctions; routes every interaction through inherited wrappers.
 */
export class SurveyTakerPage extends HelperFunctions {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to the taker URL. Does NOT assert any specific state — callers
   * pick the next assertion (question visible / expired heading / …) based on
   * what scenario they are testing.
   */
  async openRaw(url: string): Promise<void> {
    // networkidle waits for the SPA's initial API call to settle — ensures the
    // expired-state or question content is already rendered before assertions.
    await this.navigateToURL(url, 'networkidle');
  }

  async open(url: string): Promise<void> {
    await this.openRaw(url);
    await expect(this.page.locator(Selectors.survey.questionHeading).first()).toBeVisible({
      timeout: 30_000,
    });
  }

  /**
   * Dismiss the "Choose your own adventure!" instructions modal if present.
   * The modal is a non-role="dialog" overlay; the only stable handle on the
   * close button is its aria-label. We do NOT assert the close button
   * disappears afterwards — under some viewports/load conditions the close
   * button stays in the DOM until the next user interaction, and the Send
   * Response click works regardless because the click receivers are
   * positioned beneath the modal once it dismisses visually.
   */
  async dismissInstructionsModal(): Promise<void> {
    const backdrop = this.page.locator(Selectors.survey.instructionsBackdrop);
    const visible = await backdrop.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) return;
    await this.validateAndClick(Selectors.survey.instructionsCloseBtn);
    // Wait for backdrop to clear — it lingers briefly after the close click
    // and will intercept the next pointer event if we proceed immediately.
    await expect(backdrop).toBeHidden({ timeout: 10_000 });
  }

  /**
   * Submit a rating answer in AI mode (default mode).
   * Uses the default slider value (matches a real respondent who taps Send).
   * Returns once the thank-you heading is visible.
   */
  async submitDefaultRating(): Promise<void> {
    await this.dismissInstructionsModal();
    await this.validateAndClick(Selectors.survey.sendResponseBtn);
    await expect(this.page.locator(Selectors.survey.thankYouHeading)).toBeVisible({
      timeout: 30_000,
    });
  }

  /**
   * After a successful submission the composer (Send response button) is
   * removed from the DOM and the Thank-you heading takes its place. Verifying
   * BOTH transitions is stronger than checking only the thank-you heading.
   */
  async expectThankYouAndComposerGone(): Promise<void> {
    await expect(this.page.locator(Selectors.survey.thankYouHeading)).toBeVisible({
      timeout: 30_000,
    });
    await expect(this.page.locator(Selectors.survey.sendResponseBtn)).toBeHidden();
  }

  /** Assert the question heading on the taker page contains the expected text. */
  async expectQuestionText(expected: string): Promise<void> {
    await this.checkElementText(Selectors.survey.questionTitleText, expected);
  }

  /**
   * Assert the page renders the "Survey Link Has Expired" empty-state. Used
   * for non-existent and unpublished survey URLs — the app returns HTTP 200
   * and shows this message, NOT a 404 page.
   */
  async expectExpiredState(): Promise<void> {
    // 45s fallback — openRaw uses networkidle so heading is usually already
    // present; this guards against slow servers or mid-fetch navigation.
    await this.assertionValidate(Selectors.survey.expiredHeading, 45_000);
    // Composer / question must not render on the expired page.
    await expect(this.page.locator(Selectors.survey.sendResponseBtn)).toBeHidden();
  }
}
