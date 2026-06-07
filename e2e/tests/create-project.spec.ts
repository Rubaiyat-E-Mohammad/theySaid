import { test, expect, type Page } from '@playwright/test';
import { SignInPage } from '../pages/signInPage.ts';
import { ProjectsPage } from '../pages/projectsPage.ts';
import { ProjectEditorPage } from '../pages/projectEditorPage.ts';
import { TestData } from '../utils/testData.ts';

/**
 * @Test_Scenarios : [CREATE PROJECT — AI SURVEY FLOW]
 * @Test_CP0001 : User creates an AI Survey project and it appears in the projects list
 * @Test_CP0002 : Created project appears in the projects list with the correct title
 * @Test_CP0003 : Newly-created project is reachable by direct URL (UUID) after creation
 * @Test_CP0004 : Project title edited after creation persists across reload
 * @Test_CP0005 : Empty title submission is rejected — previous valid title remains
 * @Test_CP0006 : Multiple projects created in same session each get unique UUIDs
 *
 * Flow: sign in → click Add project → (handle Teach AI gating dialog) →
 * select AI Survey radio → click Create AI Survey → skip Draft dialog →
 * set title/question → assert URL has a UUID and project is reachable by UUID.
 *
 * Implementation note: the URL transition from /projects/new to
 * /projects/{uuid} is triggered by the first autosave. Empirically, the
 * editor only fires autosave once ALL four required fields are populated:
 * title, question text, low rating label, and high rating label. Setting
 * any subset (title alone, title + question, title + labels, …) leaves the
 * editor at /projects/new with a visible "Endpoint labels need to be
 * updated" warning. Tests therefore call
 * `editor.fillMinimumFieldsForAutosave(title)` (or the explicit
 * setTitle + setQuestionText + setRatingLabels sequence in CP0001) before
 * `waitForUuid()`.
 *
 * One browser opens in beforeAll and is shared across all tests in serial
 * order. beforeEach resets to the projects list so each test starts clean.
 */
test.describe('Create project', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;
  let projects: ProjectsPage;
  let editor: ProjectEditorPage;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    projects = new ProjectsPage(page);
    editor = new ProjectEditorPage(page);
    await new SignInPage(page).signIn(TestData.email, TestData.password);
    await projects.expectLoaded();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.beforeEach(async () => {
    await projects.gotoProjectsList();
  });

  test('CP0001 : User creates an AI Survey project and it appears in the projects list', async () => {
    await projects.createProject('AI Survey', {
      teachAiUrl: TestData.teachAiSeedUrl,
    });

    const title = TestData.projectTitle('CP0001 AutoQA Survey');
    await editor.setTitle(title);
    await editor.setQuestionText('How would you rate our test automation?');
    await editor.setRatingLabels('poor', 'excellent');

    // Editing the title triggers the first autosave; URL gets a UUID.
    const uuid = await editor.waitForUuid();
    expect(uuid).toMatch(/^[a-f0-9-]{36}$/);

    // And the project should be reachable from the projects page (load editor by UUID).
    await projects.expectProjectReachable(uuid);
  });

  test('CP0002 : Created project appears in the projects list with the correct title', async () => {
    await projects.createProject('AI Survey', { teachAiUrl: TestData.teachAiSeedUrl });

    const title = TestData.projectTitle('CP0002 List Visible');
    await editor.fillMinimumFieldsForAutosave(
      title,
      'CP0002 — does this title show in the list?',
    );
    const uuid = await editor.waitForUuid();
    expect(uuid).toMatch(/^[a-f0-9-]{36}$/);

    // Filter the projects list by the unique title and assert the row appears.
    await projects.expectProjectInListByTitle(title);
  });

  test('CP0003 : Newly-created project is reachable by direct URL (UUID) after creation', async () => {
    await projects.createProject('AI Survey', { teachAiUrl: TestData.teachAiSeedUrl });
    await editor.fillMinimumFieldsForAutosave(
      TestData.projectTitle('CP0003 Direct URL'),
      'CP0003 — is this reachable by UUID?',
    );
    const uuid = await editor.waitForUuid();

    // Direct navigation to /projects/{uuid} should load the editor for the
    // same project — confirms the UUID route is real and not just an alias.
    await projects.expectProjectReachable(uuid);
    await expect(page).toHaveURL(new RegExp(`/projects/${uuid}`));
  });

  test('CP0004 : Project title edited after creation persists across reload', async () => {
    await projects.createProject('AI Survey', { teachAiUrl: TestData.teachAiSeedUrl });
    const initialTitle = TestData.projectTitle('CP0004 Initial');
    await editor.fillMinimumFieldsForAutosave(
      initialTitle,
      'CP0004 — does the edited title persist?',
    );
    const uuid = await editor.waitForUuid();

    // Edit to a new title, navigate away and back — the new value must stick.
    const editedTitle = TestData.projectTitle('CP0004 Edited');
    await editor.setTitle(editedTitle);
    await editor.openByUuid(uuid);

    expect(await editor.getTitleValue()).toBe(editedTitle);
  });

  test('CP0005 : Empty title submission is rejected — previous valid title remains', async () => {
    await projects.createProject('AI Survey', { teachAiUrl: TestData.teachAiSeedUrl });
    const validTitle = TestData.projectTitle('CP0005 Valid');
    await editor.fillMinimumFieldsForAutosave(
      validTitle,
      'CP0005 — does the app reject empty titles?',
    );
    const uuid = await editor.waitForUuid();

    // Attempt an empty-title submission. The app silently drops empties —
    // verify by reloading the editor and reading the title back.
    await editor.clearTitle();
    await editor.openByUuid(uuid);

    const after = await editor.getTitleValue();
    expect(after).toBe(validTitle);
    expect(after.length).toBeGreaterThan(0);
  });

  test('CP0006 : Multiple projects created in same session each get unique UUIDs', async () => {
    // First project.
    await projects.createProject('AI Survey', { teachAiUrl: TestData.teachAiSeedUrl });
    await editor.fillMinimumFieldsForAutosave(
      TestData.projectTitle('CP0006 First'),
      'CP0006 — first project',
    );
    const firstUuid = await editor.waitForUuid();

    // Second project — go back to the projects list, then kick off Add project.
    // The `Add project` button only exists on /projects, so we must navigate
    // away from the editor first.
    await projects.gotoProjectsList();
    await projects.createProject('AI Survey', { teachAiUrl: TestData.teachAiSeedUrl });
    await editor.fillMinimumFieldsForAutosave(
      TestData.projectTitle('CP0006 Second'),
      'CP0006 — second project',
    );
    const secondUuid = await editor.waitForUuid();

    expect(firstUuid).toMatch(/^[a-f0-9-]{36}$/);
    expect(secondUuid).toMatch(/^[a-f0-9-]{36}$/);
    expect(secondUuid).not.toBe(firstUuid);
  });
});
