import 'dotenv/config';

/**
 * Env-driven test data. Only `Urls.baseUrl` lives here — derived UI paths live
 * on `HelperFunctions`. Lazy getters so the IDE can import this module for
 * test discovery without `.env` loaded.
 *
 * Accepts both canonical (`BASE_URL` / `SIGNIN_EMAIL` / `SIGNIN_PASSWORD`)
 * and legacy (`APP_URL` / `EMAIL` / `PASSWORD`) env names so the existing
 * `.env` keeps working without edits.
 */
function requireEnv(...names: string[]): string {
  for (const name of names) {
    const v = process.env[name];
    if (v && v.trim() !== '') return v;
  }
  throw new Error(
    `Missing required env var (tried ${names.join(', ')}). See .env.example.`,
  );
}

export const Urls = {
  get baseUrl() {
    // Prefer canonical BASE_URL; fall back to legacy APP_URL; final fallback
    // to the dev host so suites built against the reference repo still work.
    return (
      process.env.BASE_URL ||
      process.env.APP_URL ||
      'https://evo.dev.theysaid.io'
    );
  },
} as const;

export const Credentials = {
  get valid() {
    return {
      email: requireEnv('SIGNIN_EMAIL', 'EMAIL'),
      password: requireEnv('SIGNIN_PASSWORD', 'PASSWORD'),
    };
  },
  wrongPassword: 'WrongPassword123!',
  unregisteredEmail: 'nonexistent-user-9921@example.com',
  invalidFormatEmail: 'notanemail',
  arbitraryPassword: 'SomePass123!',
} as const;

/**
 * Legacy TestData export retained for backward-compatibility with existing
 * specs that import `TestData.email` / `TestData.password` / etc. New specs
 * should read from `Credentials` and `Urls` directly.
 */
export const TestData = {
  get email() { return Credentials.valid.email; },
  get password() { return Credentials.valid.password; },
  get appUrl() { return Urls.baseUrl; },
  teachAiSeedUrl: process.env.TEACH_AI_SEED_URL || 'theysaid.io',
  projectTitle(prefix: string): string {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    return `${prefix} ${stamp}`;
  },
};
