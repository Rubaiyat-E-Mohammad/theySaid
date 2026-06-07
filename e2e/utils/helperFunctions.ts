import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { expect, type Page } from '@playwright/test';
import { Urls } from './testData.ts';

/**
 * Action-wrapper base class every POM extends.
 * Centralises Playwright primitives (`page.goto`, `locator.click`, `locator.fill`, …)
 * and per-suite URL fields built from `Urls.baseUrl`.
 *
 * Colour contract:
 *   \x1b[34m blue    — navigate / assert
 *   \x1b[35m magenta — click / fill
 *   \x1b[33m yellow  — select
 *   \x1b[31m red     — failure
 */
export class HelperFunctions {
  readonly page: Page;

  // Non-base URLs the suite touches. Add new paths here, never inside a POM or spec.
  readonly homeUrl: string = Urls.baseUrl + '/';
  readonly signInPage: string = Urls.baseUrl + '/';
  readonly projectsPage: string = Urls.baseUrl + '/projects';
  readonly teachAiPage: string = Urls.baseUrl + '/home/teach-ai';
  projectEditorPage(uuid: string): string {
    return `${Urls.baseUrl}/projects/${uuid}`;
  }

  constructor(page: Page) {
    this.page = page;
  }

  async waitForLoading() {
    await this.page.waitForLoadState('domcontentloaded');
  }

  async navigateToURL(url: string) {
    try {
      await this.waitForLoading();
      try {
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      } catch (err) {
        const msg = (err as Error).message ?? '';
        if (!msg.includes('ERR_ABORTED')) throw err;
      }
      await this.waitForLoading();
      console.log('\x1b[34m%s\x1b[0m', `✅ Navigated to ${url}`);
    } catch (error) {
      console.log('\x1b[31m%s\x1b[0m', `❌ Failed to navigate to ${url}: ${error}`);
      throw error;
    }
  }

  async assertionValidate(locator: string) {
    try {
      await this.waitForLoading();
      const el = this.page.locator(locator);
      await el.waitFor();
      await this.waitForLoading();
      console.log('\x1b[34m%s\x1b[0m', `✅ Asserted ${locator}`);
      expect(await el.isVisible()).toBeTruthy();
    } catch (error) {
      console.log('\x1b[31m%s\x1b[0m', `❌ Failed to assert ${locator}: ${error}`);
      throw error;
    }
  }

  async validateAndClick(locator: string) {
    try {
      await this.waitForLoading();
      const el = this.page.locator(locator);
      await el.waitFor();
      await el.click();
      await this.waitForLoading();
      console.log('\x1b[35m%s\x1b[0m', `✅ Clicked ${locator}`);
    } catch (error) {
      console.log('\x1b[31m%s\x1b[0m', `❌ Failed to click ${locator}: ${error}`);
      throw error;
    }
  }

  async validateAndFillStrings(locator: string, value: string) {
    try {
      await this.waitForLoading();
      const el = this.page.locator(locator);
      await el.waitFor();
      await el.fill(value);
      await this.waitForLoading();
      console.log('\x1b[35m%s\x1b[0m', `✅ Filled ${locator} with ${value.length} chars`);
    } catch (error) {
      console.log('\x1b[31m%s\x1b[0m', `❌ Failed to fill ${locator}: ${error}`);
      throw error;
    }
  }

  async validateAndFillNumbers(locator: string, value: number) {
    await this.validateAndFillStrings(locator, value.toString());
  }

  async validateAndCheckBox(locator: string) {
    try {
      await this.waitForLoading();
      const el = this.page.locator(locator);
      await el.waitFor();
      await el.check();
      await this.waitForLoading();
      console.log('\x1b[35m%s\x1b[0m', `✅ Checked ${locator}`);
    } catch (error) {
      console.log('\x1b[31m%s\x1b[0m', `❌ Failed to check ${locator}: ${error}`);
      throw error;
    }
  }

  async selectOptionWithLabel(locator: string, label: string) {
    try {
      await this.waitForLoading();
      const el = this.page.locator(locator);
      await el.waitFor();
      await this.page.selectOption(locator, { label });
      await this.waitForLoading();
      console.log('\x1b[33m%s\x1b[0m', `✅ Selected ${locator} = ${label}`);
    } catch (error) {
      console.log('\x1b[31m%s\x1b[0m', `❌ Failed to select ${locator} with label ${label}: ${error}`);
      throw error;
    }
  }

  async selectOptionWithValue(locator: string, value: string) {
    try {
      await this.waitForLoading();
      const el = this.page.locator(locator);
      await el.waitFor();
      await this.page.selectOption(locator, { value });
      await this.waitForLoading();
      console.log('\x1b[33m%s\x1b[0m', `✅ Selected ${locator} = ${value}`);
    } catch (error) {
      console.log('\x1b[31m%s\x1b[0m', `❌ Failed to select ${locator} with value ${value}: ${error}`);
      throw error;
    }
  }

  async checkElementText(locator: string, expectedText: string) {
    try {
      await this.waitForLoading();
      const el = this.page.locator(locator);
      await el.waitFor();
      const actual = (await el.textContent())?.trim();
      expect(actual).toContain(expectedText);
      console.log('\x1b[34m%s\x1b[0m', `✅ Text on ${locator} contains "${expectedText}"`);
    } catch (error) {
      console.log('\x1b[31m%s\x1b[0m', `❌ Text mismatch on ${locator}: ${error}`);
      throw error;
    }
  }

  async validateAndClickAny(locator: string) {
    try {
      await this.waitForLoading();
      const elements = this.page.locator(locator);
      const count = await elements.count();
      for (let i = 0; i < count; i++) {
        const el = elements.nth(i);
        if (await el.isVisible()) {
          await el.click();
          await this.waitForLoading();
          console.log('\x1b[35m%s\x1b[0m', `✅ Clicked visible element ${locator}[${i}]`);
          return;
        }
      }
      throw new Error(`No visible elements found for locator: ${locator}`);
    } catch (error) {
      console.log('\x1b[31m%s\x1b[0m', `❌ Failed to click any ${locator}: ${error}`);
      throw error;
    }
  }

  async validateAny(locator: string) {
    try {
      await this.waitForLoading();
      const elements = this.page.locator(locator);
      const count = await elements.count();
      for (let i = 0; i < count; i++) {
        if (await elements.nth(i).isVisible()) {
          console.log('\x1b[34m%s\x1b[0m', `✅ Found visible ${locator}[${i}]`);
          return;
        }
      }
      throw new Error(`No visible elements found for locator: ${locator}`);
    } catch (error) {
      console.log('\x1b[31m%s\x1b[0m', `❌ Failed to validate any ${locator}: ${error}`);
      throw error;
    }
  }
}
