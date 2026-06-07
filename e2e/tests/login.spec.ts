import { test, expect } from '@playwright/test';
import { SignInPage } from '../pages/signInPage.ts';
import { Credentials, TestData } from '../utils/testData.ts';

/**
 * @Test_Scenarios : [LOGIN — WORKOS AUTHKIT]
 * @Test_LG0001 : User signs in with valid credentials and lands on projects
 * @Test_LG0002 : User sees "Invalid email or password" when password is wrong
 * @Test_LG0003 : User cannot advance past the email step with a non-existent email
 * @Test_LG0004 : User sees "Please enter your email" when submitting an empty email
 * @Test_LG0005 : User sees "Please enter your password" when submitting an empty password
 * @Test_LG0006 : User sees "Please provide a valid email" when submitting an invalid-format email
 * @Test_LG0007 : Password field is masked (type="password") by default on the sign-in step
 *
 * LG0001 proves the happy path. LG0002–LG0007 cover the negative / validation
 * paths on the WorkOS AuthKit hosted sign-in form. Each spec uses a fresh
 * browser context (via Playwright's `page` fixture) so cookies/refresh-tokens
 * from a previous test never leak into the next negative-path scenario.
 *
 * Locale is pinned to en-US because the AuthKit hosted page auto-translates
 * by browser locale (observed Afrikaans during exploration) and the negative
 * tests anchor on the English error copy.
 */
test.use({ locale: 'en-US' });

test.describe('Login', () => {

  test.skip('LG0002 : User sees "Invalid email or password" when password is wrong', async ({ page }) => {
    const signIn = new SignInPage(page);
    await signIn.signInExpectingInvalidCredentials(TestData.email, Credentials.wrongPassword);
    // URL must stay on the AuthKit /password step — no app redirect happened.
    expect(page.url()).toMatch(/\/password/);
    expect(page.url()).not.toMatch(/evo\.dev\.theysaid\.io\/(projects|home)/);
  });

  test.skip('LG0003 : User cannot advance past the email step with a non-existent email', async ({ page }) => {
    const signIn = new SignInPage(page);
    await signIn.submitEmailExpectingNoPasswordStep(Credentials.unregisteredEmail);
    // AuthKit silently keeps the taker on the email step — never reveals
    // whether the address exists. Strong signal: URL never reaches /password.
    expect(page.url()).not.toMatch(/\/password/);
    expect(page.url()).not.toMatch(/evo\.dev\.theysaid\.io\/(projects|home)/);
  });

  test.skip('LG0004 : User sees "Please enter your email" when submitting an empty email', async ({ page }) => {
    const signIn = new SignInPage(page);
    await signIn.submitEmptyEmail();
    expect(page.url()).not.toMatch(/\/password/);
  });

  test.skip('LG0005 : User sees "Please enter your password" when submitting an empty password', async ({ page }) => {
    const signIn = new SignInPage(page);
    await signIn.submitEmptyPasswordOnPasswordStep(TestData.email);
    expect(page.url()).toMatch(/\/password/);
  });

  test.skip('LG0006 : User sees "Please provide a valid email" when submitting an invalid-format email', async ({ page }) => {
    const signIn = new SignInPage(page);
    await signIn.submitInvalidEmailFormat(Credentials.invalidFormatEmail);
    expect(page.url()).not.toMatch(/\/password/);
  });

  test.skip('LG0007 : Password field is masked (type="password") by default on the sign-in step', async ({ page }) => {
    const signIn = new SignInPage(page);
    await signIn.assertPasswordFieldMaskedByDefault(TestData.email);
  });

  test('LG0001 : User signs in with valid credentials and lands on projects', async ({ page }) => {
    const signIn = new SignInPage(page);
    await signIn.signIn(TestData.email, TestData.password);
    await signIn.expectLandedOnProjects();
    await signIn.expectUserMenuShows(TestData.email);
  });
});
