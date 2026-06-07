import { test, expect, type Page } from '@playwright/test';
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
 *   - Author side: shared signed-in page → navigate to /projects → create AI
 *     Survey project → set title / question → Publish → extract shareable URL.
 *   - Taker side: fresh browser context (no auth cookies) → open survey URL.
 *
 * Each author-side test creates its own project with a unique timestamped
 * title so tests remain independent when run serially. The shared page is
 * already authenticated; createAndPublishProject navigates to /projects
 * rather than re-signing in.
 *
 * One browser opens in beforeAll and is shared across all tests in serial
 * order. Taker-side tests open isolated anonymous contexts per test and
 * close them in a finally block.
 */
test.describe('Publish project + take survey', () => {
  // retries: 1 guards against intermittent network blips on the AuthKit
  // sign-in page (rare under serial load but observed during exploration).
  test.describe.configure({ mode: 'serial', retries: 1 });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await new SignInPage(page).signIn(TestData.email, TestData.password);
    await new ProjectsPage(page).expectLoaded();
  });

  test.afterAll(async () => {
    await page.close();
  });

  /**
   * Navigates to /projects, creates a new AI Survey, fills all required
   * fields, and publishes — returning the UUID and shareable survey URL.
   * Does NOT sign in; assumes the shared `page` is already authenticated.
   */
  async function createAndPublishProject(
    titlePrefix: string,
  ): Promise<{ uuid: string; surveyUrl: string; editor: ProjectEditorPage }> {
    const projects = new ProjectsPage(page);
    const editor = new ProjectEditorPage(page);

    await projects.gotoProjectsList();
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
    browser,
  }) => {
    const { uuid, surveyUrl } = await createAndPublishProject('PB0001 Publish & Take');
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

  test('PB0002 : Publish dialog shows a shareable link that contains the project UUID', async () => {
    const { uuid, surveyUrl } = await createAndPublishProject('PB0002 Link UUID');
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

  test('PB0003 : Anonymous taker (no auth cookies) can open a published survey URL', async ({
    browser,
  }) => {
    const { surveyUrl } = await createAndPublishProject('PB0003 Anonymous Access');

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

  test('PB0004 : Submitting hides the composer and shows the Thank-you heading', async ({
    browser,
  }) => {
    const { surveyUrl } = await createAndPublishProject('PB0004 Thank You');

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

  test('PB0005 : Re-publishing the same project preserves the original shareable link', async () => {
    const { uuid, surveyUrl: firstUrl, editor } = await createAndPublishProject(
      'PB0005 Re-publish',
    );
    expect(firstUrl).toContain(uuid);

    // Close the publish dialog and publish again. The shareable link is
    // derived from the immutable project UUID, so it must not change.
    await editor.closePublishDialog();
    const secondUrl = await editor.publish();
    expect(secondUrl).toBe(firstUrl);
  });

  test('PB0006 : Anonymous taker visiting a non-existent survey URL sees the expired-link state', async ({
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
