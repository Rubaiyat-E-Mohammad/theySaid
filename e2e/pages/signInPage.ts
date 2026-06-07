import { expect, type Page } from '@playwright/test';
import { HelperFunctions } from '../utils/helperFunctions.ts';
import { Selectors } from '../utils/selectors.ts';

/**
 * SignInPage — owns the WorkOS AuthKit sign-in flow.
 * Extends HelperFunctions; routes every interaction through inherited wrappers.
 *
 * Uses generous waits on the AuthKit-hosted fields because the redirect chain
 * (evo.dev.theysaid.io → mystical-turtle-...authkit.app) can be slow under
 * parallel load (4 workers signing in simultaneously).
 */
export class SignInPage extends HelperFunctions {
  constructor(page: Page) {
    super(page);
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.navigateToURL(this.signInPage);
    // AuthKit redirects to its hosted page when not authenticated. Wait for
    // the URL to actually land on the AuthKit domain before probing the form.
    await this.page.waitForURL(/authkit\.app|theysaid\.io/, { timeout: 30_000 });
    await this.validateAndFillStrings(Selectors.signIn.emailInput, email);
    await this.validateAndClick(Selectors.signIn.continueBtn);
    await this.validateAndFillStrings(Selectors.signIn.passwordInput, password);
    await this.validateAndClick(Selectors.signIn.signInBtn);
    // Wait for redirect back to evo.dev.theysaid.io
    await this.page.waitForURL(/evo\.dev\.theysaid\.io\/(projects|home)/, { timeout: 45_000 });
    await this.dismissCookieBanner();
  }

  /** The cookie banner can intercept clicks if left open. Dismiss if present. */
  async dismissCookieBanner(): Promise<void> {
    // page.isVisible is permitted in POMs for conditional branching; only the
    // actual click goes through the helper wrapper.
    const visible = await this.page.locator(Selectors.app.cookieRejectAll)
      .isVisible()
      .catch(() => false);
    if (visible) {
      await this.validateAndClick(Selectors.app.cookieRejectAll);
    }
  }

  async expectLandedOnProjects(): Promise<void> {
    // After auth the app routes to /projects (or /home in some edge cases).
    await expect(this.page).toHaveURL(/\/(projects|home)/);
    await this.assertionValidate(Selectors.projects.heading);
  }

  async expectUserMenuShows(email: string): Promise<void> {
    await this.checkElementText(Selectors.app.userMenu, email);
  }

  /**
   * Navigate to the sign-in page and wait for the AuthKit-hosted email form
   * to be ready. Used by negative-path tests that don't run the full login.
   */
  async gotoSignIn(): Promise<void> {
    await this.navigateToURL(this.signInPage);
    await this.page.waitForURL(/authkit\.app|theysaid\.io/, { timeout: 30_000 });
    await this.assertionValidate(Selectors.signIn.emailInput);
  }

  /** Fill the email field then click Continue (advances to the password step). */
  async submitEmail(email: string): Promise<void> {
    await this.validateAndFillStrings(Selectors.signIn.emailInput, email);
    await this.validateAndClick(Selectors.signIn.continueBtn);
  }

  /**
   * Fill the password field then click Sign in.
   * Caller is responsible for being on the /password step beforehand.
   */
  async submitPassword(password: string): Promise<void> {
    await this.validateAndFillStrings(Selectors.signIn.passwordInput, password);
    await this.validateAndClick(Selectors.signIn.signInBtn);
  }

  /**
   * LG0002 helper — exercises the full wrong-password path and asserts that
   * the in-page "Invalid email or password" error is shown while the URL
   * remains on the AuthKit /password step (i.e. no auth redirect happened).
   */
  async signInExpectingInvalidCredentials(email: string, wrongPassword: string): Promise<void> {
    await this.gotoSignIn();
    await this.submitEmail(email);
    await this.page.waitForURL(/\/password/, { timeout: 15_000 });
    await this.submitPassword(wrongPassword);
    await this.assertionValidate(Selectors.signIn.invalidCredentialsError);
    expect(this.page.url()).toMatch(/\/password/);
  }

  /**
   * LG0003 helper — non-existent email. AuthKit does NOT route to /password
   * (security: never reveal whether the email exists). The taker is left on
   * the email step. We assert by URL — the path stays at the AuthKit root
   * sign-in screen and the email input remains visible.
   */
  async submitEmailExpectingNoPasswordStep(email: string): Promise<void> {
    await this.gotoSignIn();
    await this.submitEmail(email);
    // State-based wait for the AuthKit round-trip to settle. Observed
    // behaviour: after submitting an email, the URL either gains a /password
    // segment (registered) or loses its `client_id=` param (non-existent —
    // AuthKit redirects back to the email step silently). Polling the URL via
    // `waitForURL` returns as soon as either transition completes.
    await this.page.waitForURL((url) =>
      url.pathname.includes('/password') || !url.searchParams.has('client_id'),
      { timeout: 15_000 },
    );
    expect(this.page.url()).not.toMatch(/\/password/);
    await this.assertionValidate(Selectors.signIn.emailInput);
  }

  /**
   * LG0004 helper — submit with an empty email field. AuthKit shows an inline
   * "Please enter your email" message and stays on the same step.
   */
  async submitEmptyEmail(): Promise<void> {
    await this.gotoSignIn();
    await this.validateAndFillStrings(Selectors.signIn.emailInput, '');
    await this.validateAndClick(Selectors.signIn.continueBtn);
    await this.assertionValidate(Selectors.signIn.emptyEmailError);
    expect(this.page.url()).not.toMatch(/\/password/);
  }

  /**
   * LG0005 helper — advance to the password step, then submit with the
   * password field empty. AuthKit shows "Please enter your password" inline.
   */
  async submitEmptyPasswordOnPasswordStep(validEmail: string): Promise<void> {
    await this.gotoSignIn();
    await this.submitEmail(validEmail);
    await this.page.waitForURL(/\/password/, { timeout: 15_000 });
    await this.validateAndFillStrings(Selectors.signIn.passwordInput, '');
    await this.validateAndClick(Selectors.signIn.signInBtn);
    await this.assertionValidate(Selectors.signIn.emptyPasswordError);
    expect(this.page.url()).toMatch(/\/password/);
  }

  /**
   * LG0006 helper — submit a value that does not look like an email at all.
   * AuthKit shows "Please provide a valid email" and stays on the email step.
   * (HTML5 typeMismatch is also true but the in-page text is the user-visible
   * signal we anchor the test on.)
   */
  async submitInvalidEmailFormat(badInput: string): Promise<void> {
    await this.gotoSignIn();
    await this.validateAndFillStrings(Selectors.signIn.emailInput, badInput);
    await this.validateAndClick(Selectors.signIn.continueBtn);
    await this.assertionValidate(Selectors.signIn.invalidEmailFormatError);
    expect(this.page.url()).not.toMatch(/\/password/);
  }

  /**
   * LG0007 helper — assert the password field is masked (`type="password"`)
   * by default. Reads the `type` attribute via Playwright (no helper wrapper
   * needed — this is a pure read, not an action).
   */
  async assertPasswordFieldMaskedByDefault(validEmail: string): Promise<void> {
    await this.gotoSignIn();
    await this.submitEmail(validEmail);
    await this.page.waitForURL(/\/password/, { timeout: 15_000 });
    const type = await this.page.locator(Selectors.signIn.passwordInput).getAttribute('type');
    expect(type).toBe('password');
  }
}
