# Issues Found — TheySaid AI (evo.dev.theysaid.io)

Bonus deliverable per assessment instruction [09].

Site under test: `https://evo.dev.theysaid.io/`
Tested: 2026-06-07

---

## Issue 1 — Voice reply does not work properly

**Severity:** Major
**Surface:** Survey taker — AI mode response composer
**Repro:**
1. Sign in, open any published survey URL as an anonymous taker.
2. Click the microphone / voice-reply button in the response composer.
3. Speak a reply.

**Expected:** Voice input is transcribed and sent as the survey answer, equivalent to typing it.

**Observed:** Voice capture starts but the transcribed text either does not appear in the composer, gets cut off mid-utterance, or the Send button does not enable after recording. Replay attempts (start/stop/start) leave the composer in a stuck state and the user has to refresh the page to type a reply instead.

**Impact:** Voice-first respondents on mobile cannot complete surveys. Falls back silently to typed input, but the affordance is broken — surveyors may lose responses they think were captured.

---

## Issue 2 — "Choose your own adventure!" modal — close button overlaps right pane content

**Severity:** Minor (UX / design)
**Surface:** Survey taker — onboarding modal on first visit to a published survey
**Repro:**
1. Open any published survey URL as an anonymous taker.
2. The "Choose your own adventure!" instructional modal appears centered over the survey UI.
3. Observe the `×` (close) button placement.

**Expected:** Close button sits inside the modal's own header area, fully contained, without visually intruding on adjacent UI behind/beside it.

**Observed:** The close button is rendered at the modal's top-right corner in a way that visually overlaps and crowds the right-side question card (e.g. "How would you rate our test automation?"). The `×` icon appears to "spill" onto the panel behind the modal, making the layout look broken and cluttered.

**Suggested fix:** Move the close button slightly inward (e.g. `right: 16px; top: 16px` relative to the modal's own bounding box) and/or add a small drop shadow / divider so the modal is visually anchored separately from the survey card behind it.

**Screenshot:** `docs/modal-close-button-overlap.png`
_(Drag the local screenshot file into the GitHub issue or this file's commit on the web UI to attach.)_

---

## Issue 3 — "Add project" opens Teach AI gate dialog every time (looks like a permission error)

**Severity:** Minor (UX / messaging)
**Surface:** `/projects` — Add project button
**Repro:**
1. Sign in as a returning user with at least one prior project.
2. Click "Add project" on the projects page.

**Observed:** A Teach AI onboarding dialog opens every click — even though the user has already completed Teach AI setup in a previous session. Users misread this as a permission / access issue.

**Suggested fix:** Show the gate dialog only when the user has not yet uploaded any Teach AI data sources. For returning users with seeded data, jump straight into the new-project editor.

---

## Issue 4 — Publish dialog truncates shareable link

**Severity:** Trivial
**Surface:** Project editor — Publish dialog
**Repro:**
1. Open any project in the editor.
2. Click Publish.
3. Observe the shareable link button in the resulting dialog.

**Observed:** The link is rendered with an ellipsis (`…`) when the dialog is narrow. The visible truncated string is not the actual URL — copying via double-click may grab the truncated text rather than the full URL.

**Suggested fix:** Either widen the link container, render the full URL with `word-break: break-all`, or only ever expose the link via the "Click to copy" action — never via visible double-click text.

---

## Issue 5 — Survey re-shows instructions modal + allows re-submission after thank-you screen

**Severity:** Major (data integrity)
**Surface:** Survey taker — AI mode
**Repro:**
1. As an anonymous taker, submit a response on a published survey.
2. Observe the thank-you screen.
3. Wait or interact with the page background.

**Observed:** After the thank-you screen renders, the page state resets — the "Choose your own adventure!" instructions modal re-appears and the response composer becomes editable again. The same taker can submit a second (different) response on the same survey from the same session, with no warning that they already submitted.

**Impact:** A single respondent can pollute survey data with multiple submissions. Quantitative analytics over-count engagement and skew sentiment averages.

**Suggested fix:** After submission, lock the page into a terminal thank-you state OR redirect to a `/survey/<id>/submitted` URL. Track submitter via cookie/localStorage so refresh-and-resubmit is also blocked.

---

## Issue 6 — Project title can be created empty (UI permits whitespace-only title)

**Severity:** Minor
**Surface:** Project editor — title field
**Repro:**
1. Create a new project, leave title blank or whitespace-only.
2. Observe the project appears in the list with an empty / default title.

**Observed:** The UI accepts the empty title silently and assigns a placeholder; no inline validation flags this. Listing pages render an empty-looking row.

**Suggested fix:** Inline validation on the title field — trim whitespace, require ≥1 character before allowing project creation.

---

## Summary

| # | Issue                                            | Severity | Type            |
| - | ------------------------------------------------ | -------- | --------------- |
| 1 | Voice reply does not work properly               | Major    | Functional bug  |
| 2 | Modal close button overlaps right pane           | Minor    | UI / design     |
| 3 | "Add project" gate dialog confuses returning users | Minor  | UX / messaging  |
| 4 | Publish dialog truncates shareable link          | Trivial  | UI              |
| 5 | Survey allows re-submission after thank-you      | Major    | Data integrity  |
| 6 | Empty project title silently accepted            | Minor    | Validation      |
