# TheySaid — E2E Test Suite

Playwright E2E test suite for [evo.dev.theysaid.io](https://evo.dev.theysaid.io/) — the TheySaid AI survey platform.

## Coverage — 25 tests across 4 flows

| IDs          | Flow                          | Spec                                        | Tests |
| ------------ | ----------------------------- | ------------------------------------------- | ----- |
| LG0001–LG0007 | Sign-in (WorkOS AuthKit)     | `e2e/tests/login.spec.ts`                   | 7     |
| CP0001–CP0006 | Create AI Survey project     | `e2e/tests/create-project.spec.ts`          | 6     |
| TA0001–TA0006 | Teach AI — upload data source | `e2e/tests/teach-ai-upload.spec.ts`        | 6     |
| PB0001–PB0006 | Publish survey + take survey | `e2e/tests/publish-and-take-survey.spec.ts` | 6     |

All 25 tests are active and green. Registration (OTP-gated) is intentionally skipped.

## Layout

Canonical AutoQA layout — sibling `e2e/`, `.github/`, `.claude/` at repo root. Helpers in `utils/`, POMs in `pages/`, specs in `tests/`.

```
TheySaid/
├── .github/workflows/e2e.yml         # CI — 4-shard matrix run
├── .claude/                          # AutoQA agent definition
└── e2e/
    ├── .env.example                  # BASE_URL, SIGNIN_EMAIL, SIGNIN_PASSWORD
    ├── .mcp.json                     # Playwright-test MCP server config
    ├── playwright.config.ts          # 1 worker, serial specs; blob reporter in CI
    ├── pages/                        # POMs (each extends HelperFunctions)
    ├── tests/                        # Specs (one POM call per test)
    ├── utils/
    │   ├── helperFunctions.ts        # Single class — Playwright UI primitives live here only
    │   ├── selectors.ts              # Nested per-feature locator strings
    │   ├── testData.ts               # Env-driven Urls + Credentials
    │   └── featureMapReporter.ts     # Markdown summary → GITHUB_STEP_SUMMARY
    ├── feature-map/feature-map.yml   # ID → spec registry
    └── uploadeditems/                # Static upload fixtures
```

## Setup

```bash
cd e2e
npm install
npx playwright install chromium
cp .env.example .env
# edit .env: BASE_URL=https://evo.dev.theysaid.io
#           SIGNIN_EMAIL=...
#           SIGNIN_PASSWORD=...
```

## Run

```bash
cd e2e
npm test                # headless, 1 worker
npm run test:local      # headed
npm run test:ui         # Playwright UI mode
npm run report          # open last HTML report
npm run report:merge    # merge sharded blob reports into HTML
```

Expected: `25 passed (~4m)` on a clean run.

## CI

`.github/workflows/e2e.yml` runs on push + pull_request to `main`. 4-shard matrix (one shard per spec file) → `merge-reports` job produces a single `playwright-report/` artifact. Requires repo secrets: `TEST_EMAIL`, `TEST_PASSWORD`. Optional var: `BASE_URL` (defaults to `https://evo.dev.theysaid.io`).

## Session recording

> _Google Drive viewable link here:_
>
> [Session recording — qa-interview-2026-06-07](https://drive.google.com/file/d/1adBXKeqyJJ7xodr-2nsYeG5-N1dwSozx/view?usp=sharing)
>
> _Work_Session_Recording:_ <https://www.awesomescreenshot.com/video/53339981?key=98e21beb3d76d9a4fb2f67d150906de4>

## Issues found (bonus)

See [`ISSUES.md`](./ISSUES.md) for 6 reported issues — including a voice-reply functional bug and a modal-close-button design issue (`docs/modal-close-button-overlap.png`).