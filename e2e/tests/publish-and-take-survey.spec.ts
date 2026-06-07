import { test, expect } from '@playwright/test';
import { SignInPage } from '../pages/signInPage.ts';
import { ProjectsPage } from '../pages/projectsPage.ts';
import { ProjectEditorPage } from '../pages/projectEditorPage.ts';
import { SurveyTakerPage } from '../pages/surveyTakerPage.ts';
import { TestData, Urls } from '../utils/testData.ts';

/**
 * @Test_Scenarios : [PUBLISH PROJECT + TAKE SURVEY]
 * @Test_PB0001 : User publishes an AI Survey and an anonymous taker submits a response
 * @Test_PB0002 : Publish dialog shows a shareable link that contains the project UUID
 * @Test_PB0003 : Anonymous taker (no auth cookies) can open a published survey URL
 * @Test_PB0004 : Submitting hides the composer and shows the Thank-you heading
 * @Test_PB0005 : Re-publishing the same project preserves the original shareable link
 * @Test_PB0006 : Anonymous taker visiting a non-existent survey URL sees the expired-link state
 *
 * Flow primitives:
 *   - Author side: sign in → create AI Survey project → set title / question →
 *     Publish → extract shareable URL.
 *   - Taker side: fresh browser context (no auth cookies) → open survey URL.
 *
 * Each author-side test runs the full create-and-publish dance because the
 * suite is fully-parallel; tests do not share project state.
 */
test.describe('Publish project + take survey', () => {
  // The AuthKit-hosted sign-in form occasionally fails to render its email
  // input on the first navigation under parallel load — same flake observed
  // in other spec files. Allow a single retry locally so a pre-existing
  // network blip doesn't fail the suite. CI already retries via the global
  // playwright.config.ts setting.
  test.describe.configure({ retries: 1 });

  /**
   * Helper used by every author-side test. Performs sign-in, project creation,
   * title / question / labels, then publishes — returning both the UUID and
   * the shareable survey URL. Centralising the flow keeps the spec readable
   * while letting each test focus on the specific assertion it owns.
   */
  async function createAndPublishProject(
    page: import('@playwright/test').Page,
    titlePrefix: string,
  ): Promise<{ uuid: string; surveyUrl: string; editor: ProjectEditorPage }> {
    const signIn = new SignInPage(page);
    const projects = new ProjectsPage(page);
    const editor = new ProjectEditorPage(page);

    await signIn.signIn(TestData.email, TestData.password);
    await projects.expectLoaded();
    await projects.createProject('AI Survey', {
      teachAiUrl: TestData.teachAiSeedUrl,
    });

    const title = TestData.projectTitle(titlePrefix);
    await editor.setTitle(title);
    await editor.setQuestionText('How would you rate this E2E publish flow?');
    await editor.setRatingLabels('poor', 'excellent');

    const uuid = await editor.waitForUuid();
    const surveyUrl = await editor.publish();
    return { uuid, surveyUrl, editor };
  }

  test('PB0001 : User publishes an AI Survey and an anonymous taker submits a response', async ({
    page,
    browser,
  }) => {
    const { uuid, surveyUrl } = await createAndPublishProject(page, 'PB0001 Publish & Take');
    expect(surveyUrl).toContain(uuid);

    // Respondent side: anonymous browser context.
    const respondentContext = await browser.newContext();
    const respondentPage = await respondentContext.newPage();
    try {
      const taker = new SurveyTakerPage(respondentPage);
      await taker.open(surveyUrl);
      await taker.submitDefaultRating();
    } finally {
      await respondentContext.close();
    }
  });

  test.skip('PB0002 : Publish dialog shows a shareable link that contains the project UUID', async ({
    page,
  }) => {
    const { uuid, surveyUrl } = await createAndPublishProject(page, 'PB0002 Link UUID');
    // The dialog rendered a URL on /survey/project/{uuid}. Two assertions:
    //   1. The link is an absolute HTTPS URL on the configured base.
    //   2. The same UUID we parsed from the editor URL is embedded in the link.
    expect(surveyUrl).toMatch(/^https?:\/\//);
    expect(surveyUrl).toContain('/survey/project/');
    expect(surveyUrl).toContain(uuid);
    // The link must also start with the configured BASE_URL host so it is
    // actually shareable — not a localhost-only / relative link.
    expect(surveyUrl.startsWith(Urls.baseUrl)).toBeTruthy();
  });

  test.skip('PB0003 : Anonymous taker (no auth cookies) can open a published survey URL', async ({
    page,
    browser,
  }) => {
    const { surveyUrl } = await createAndPublishProject(page, 'PB0003 Anonymous Access');

    // Fresh isolated context — no auth cookies, no localStorage from the author.
    const respondentContext = await browser.newContext();
    const respondentPage = await respondentContext.newPage();
    try {
      const taker = new SurveyTakerPage(respondentPage);
      await taker.open(surveyUrl);
      // The taker must land on the survey URL (no redirect to /sign-in)
      // and see the original question text.
      await expect(respondentPage).toHaveURL(new RegExp('/survey/project/'));
      await taker.expectQuestionText('How would you rate this E2E publish flow?');
    } finally {
      await respondentContext.close();
    }
  });

  test.skip('PB0004 : Submitting hides the composer and shows the Thank-you heading', async ({
    page,
    browser,
  }) => {
    const { surveyUrl } = await createAndPublishProject(page, 'PB0004 Thank You');

    const respondentContext = await browser.newContext();
    const respondentPage = await respondentContext.newPage();
    try {
      const taker = new SurveyTakerPage(respondentPage);
      await taker.open(surveyUrl);
      await taker.submitDefaultRating();
      // Stronger post-condition: composer Send button is gone, thank-you stays.
      await taker.expectThankYouAndComposerGone();
    } finally {
      await respondentContext.close();
    }
  });

  test.skip('PB0005 : Re-publishing the same project preserves the original shareable link', async ({
    page,
  }) => {
    const { uuid, surveyUrl: firstUrl, editor } = await createAndPublishProject(
      page,
      'PB0005 Re-publish',
    );
    expect(firstUrl).toContain(uuid);

    // Close the publish dialog and publish again. The shareable link is
    // derived from the immutable project UUID, so it must not change.
    await editor.closePublishDialog();
    const secondUrl = await editor.publish();
    expect(secondUrl).toBe(firstUrl);
  });

  test.skip('PB0006 : Anonymous taker visiting a non-existent survey URL sees the expired-link state', async ({
    browser,
  }) => {
    // No author flow required — we test the public empty-state directly.
    // A non-existent UUID and an unpublished project return identical UX:
    // HTTP 200 + "Oops! This Survey Link Has Expired" copy (NOT 404).
    const respondentContext = await browser.newContext();
    const respondentPage = await respondentContext.newPage();
    try {
      const taker = new SurveyTakerPage(respondentPage);
      const bogusUrl = `${Urls.baseUrl}/survey/project/00000000-0000-0000-0000-000000000000`;
      await taker.openRaw(bogusUrl);
      await taker.expectExpiredState();
    } finally {
      await respondentContext.close();
    }
  });
});
