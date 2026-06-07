# TheySaid — E2E Test Suite

Playwright E2E test suite for [evo.dev.theysaid.io](https://evo.dev.theysaid.io/) — the TheySaid AI survey platform.

## Coverage — 4 core flows

| ID     | Flow                                                          | Spec                                       |
| ------ | ------------------------------------------------------------- | ------------------------------------------ |
| LG0001 | User signs in with valid credentials                          | `e2e/tests/login.spec.ts`                  |
| CP0001 | User creates an AI Survey project                             | `e2e/tests/create-project.spec.ts`         |
| TA0001 | User uploads a `.txt` document via Teach AI                   | `e2e/tests/teach-ai-upload.spec.ts`        |
| PB0001 | User publishes an AI Survey + anonymous taker submits         | `e2e/tests/publish-and-take-survey.spec.ts`|

Registration (OTP-gated) is intentionally skipped per assessment instructions.

Additional exploratory tests (LG0002–LG0007, CP0002–CP0006, TA0002–TA0006, PB0002–PB0006) are present but marked `test.skip(...)` — uncomment to extend coverage.

## Layout

Canonical AutoQA layout — sibling `e2e/`, `.github/`, `.claude/` at repo root. Helpers in `utils/`, POMs in `pages/`, specs in `tests/`.

```
TheySaid/
├── .github/workflows/e2e_tests.yml   # CI — 4-shard matrix run
├── .claude/                          # AutoQA agent definition
└── e2e/
    ├── .env.example                  # BASE_URL, SIGNIN_EMAIL, SIGNIN_PASSWORD
    ├── .mcp.json                     # Playwright-test MCP server config
    ├── playwright.config.ts          # 4 workers, html + list + featureMap reporters
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
npm test              # headless, 4 workers
npm run test:local    # headed (HEADED=1)
npm run test:ui       # Playwright UI mode
npm run report        # open last HTML report
```

Expected: `4 passed, 21 skipped (~30s)` on a fresh run.

## CI

`.github/workflows/e2e_tests.yml` runs on push + pull_request. 4-shard matrix → merge-reports job → uploaded `playwright-report/` artifact. Requires repo secrets: `BASE_URL`, `SIGNIN_EMAIL`, `SIGNIN_PASSWORD`.

## Session recording

> _Add your Google Drive viewable link here:_
>
> [Session recording — qa-interview-2026-06-07](https://drive.google.com/file/d/1adBXKeqyJJ7xodr-2nsYeG5-N1dwSozx/view?usp=sharing)
