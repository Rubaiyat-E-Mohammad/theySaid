import { expect, type Page } from '@playwright/test';
import { HelperFunctions } from '../utils/helperFunctions.ts';
import { Selectors } from '../utils/selectors.ts';

export type ProjectType = 'AI User Test' | 'AI Interview' | 'AI Survey' | 'AI Poll';

/**
 * ProjectsPage — projects list at /projects and the create-project flow.
 * Extends HelperFunctions; routes every interaction through inherited wrappers.
 */
export class ProjectsPage extends HelperFunctions {
  constructor(page: Page) {
    super(page);
  }

  async expectLoaded(): Promise<void> {
    await this.assertionValidate(Selectors.projects.heading);
  }

  /**
   * Navigate to the projects list and wait for the heading to render. Used
   * when a test creates more than one project in the same session: after
   * the first creation the page is on the editor, so we must return to
   * /projects before clicking Add project again.
   */
  async gotoProjectsList(): Promise<void> {
    await this.navigateToURL(this.projectsPage);
    await this.dismissCookieBanner();
    await this.expectLoaded();
  }

  /** Dismiss the cookie banner if present. */
  async dismissCookieBanner(): Promise<void> {
    const visible = await this.page.locator(Selectors.app.cookieRejectAll)
      .isVisible()
      .catch(() => false);
    if (visible) {
      await this.validateAndClick(Selectors.app.cookieRejectAll);
    }
  }

  /**
   * Drive the Add project flow up to the editor:
   *   1. Click "Add project"
   *   2. If Teach AI gate dialog appears, fill URL and Continue
   *   3. Pick project type, click Create
   *   4. Skip the Draft project dialog (it always appears for new projects)
   *
   * The project starts at /projects/new without a UUID — the URL only
   * transitions to /projects/{uuid} once the first autosave fires (which
   * is triggered by editing the title or question). The caller therefore
   * follows this with editor.setTitle(...) + editor.waitForUuid().
   */
  async createProject(type: ProjectType, opts: { teachAiUrl?: string } = {}): Promise<void> {
    await this.validateAndClick(Selectors.projects.addProjectBtn);

    // The Teach AI gating dialog can appear — wait briefly and pass through if so.
    const gateDialog = this.page.locator(Selectors.teachAiGate.dialog);
    try {
      await gateDialog.waitFor({ state: 'visible', timeout: 4_000 });
      const url = opts.teachAiUrl ?? 'theysaid.io';
      await this.validateAndFillStrings(Selectors.teachAiGate.urlInput, url);
      await this.validateAndClick(Selectors.teachAiGate.continueBtnInDialog);
    } catch {
      // Gate not shown this time — proceed to the create dialog.
    }

    // Create project dialog with project-type radios.
    await this.assertionValidate(Selectors.createProjectDialog.dialog);
    await this.validateAndClick(Selectors.createProjectDialog.radio(type));
    await this.validateAndClick(Selectors.createProjectDialog.createBtn(type));

    // Land on the editor. URL is /projects/new at this point; UUID comes after autosave.
    await this.page.waitForURL(/\/projects\/(new|[a-f0-9-]{36})/, { timeout: 20_000 });

    // Skip the Draft project dialog (always shown for newly created projects).
    await this.assertionValidate(Selectors.draftProjectDialog.dialog);
    await this.validateAndClick(Selectors.draftProjectDialog.skipBtn);
    await expect(this.page.locator(Selectors.draftProjectDialog.dialog)).toBeHidden();
  }

  /**
   * Verify the project is reachable by navigating directly to its editor URL.
   * Used because the "Current" tab on /projects only shows published projects,
   * and freshly-created drafts can also be pushed off the first page by the
   * default "Last Response" sort. The most reliable check is that the
   * editor itself loads for the given UUID.
   */
  async expectProjectReachable(uuid: string): Promise<void> {
    await this.navigateToURL(this.projectEditorPage(uuid));
    await this.dismissCookieBanner();
    await this.assertionValidate(Selectors.projectEditor.titleInput);
    // Sanity: the URL must still contain the UUID after any client-side hydration.
    await expect(this.page).toHaveURL(new RegExp(`/projects/${uuid}`));
  }

  /**
   * Visit the projects list, filter by title via the built-in search, and
   * assert a row with that exact title is rendered. Search uses ?q= server-side
   * so the table re-renders to matching rows only — avoids paging across 30+
   * existing projects to find a freshly-created one.
   */
  async expectProjectInListByTitle(title: string): Promise<void> {
    await this.navigateToURL(this.projectsPage);
    await this.dismissCookieBanner();
    await this.expectLoaded();
    await this.validateAndFillStrings(Selectors.projects.searchInput, title);
    // The URL gains ?q=<term> when the debounced search fires; wait on the
    // URL change instead of a fixed sleep so we know the list actually
    // re-fetched before we assert.
    await this.page.waitForURL(/\?q=/, { timeout: 10_000 });
    await this.assertionValidate(Selectors.projects.rowTitleParagraph(title));
  }
}
