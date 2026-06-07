/**
 * Central selector store. ALL locator strings live here.
 * Spec files and POMs only reference these constants.
 *
 * Dialog selector strategy: every modal in TheySaid is rendered with an
 * explicit `role="dialog"` wrapper. Anchoring by `[role="dialog"]:has-text(...)`
 * uniquely identifies the dialog by its visible heading, and chaining a
 * descendant selector finds the action button or input inside it.
 */
export const Selectors = {
  // Sign-in (WorkOS AuthKit hosted page)
  signIn: {
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    continueBtn: 'button:has-text("Continue")',
    signInBtn: 'button:has-text("Sign in")',
    // Validation / error copy — observed live on the AuthKit page. AuthKit
    // renders these as plain text nodes (no role="alert"), so the text= engine
    // is the most stable anchor. Locale-pinned to en-US via `test.use` in the
    // spec — AuthKit will auto-translate otherwise.
    invalidCredentialsError: 'text=/Invalid email or password/i',
    emptyEmailError: 'text=/Please enter your email/i',
    emptyPasswordError: 'text=/Please enter your password/i',
    invalidEmailFormatError: 'text=/Please provide a valid email/i',
  },

  // Global app shell
  app: {
    cookieDialog: '[role="dialog"]:has-text("We use cookies")',
    cookieRejectAll: 'button:has-text("Reject all")',
    sidebarNav: 'nav[aria-label="Main navigation"]',
    sidebarAiProjectsLink: 'nav a[href="/projects"]',
    sidebarTeachAiLink: 'nav a[href="/home/teach-ai"]',
    userMenu: 'button[aria-label="User menu"]',
  },

  // Projects list page
  projects: {
    heading: 'h1:has-text("AI Projects")',
    addProjectBtn: 'button[data-test="add-project-button"]',
    projectsTable: 'table',
    projectRowLink: (uuid: string) => `a[href*="/projects/${uuid}"]`,
    /** Free-text search input above the table — filtering uses server-side ?q=. */
    searchInput: 'input[placeholder="Search projects..."]',
    /** Row link inside the projects table that points at a specific UUID. */
    rowLinkByUuid: (uuid: string) => `table a[href*="/projects/${uuid}"]`,
    /**
     * The project title is rendered as a <p> inside the row link. Matching by
     * exact normalised text avoids collisions with similar titles created in
     * other test runs.
     */
    rowTitleParagraph: (title: string) =>
      `table a[href*="/projects/"] p:text-is("${title}")`,
  },

  // Teach AI gating dialog (opened by Add project on first project, then optional)
  teachAiGate: {
    dialog: '[role="dialog"]:has-text("Teach AI")',
    urlInput: '#survey-link',
    additionalInfoTextarea: 'textarea#text-input, textarea[aria-label="Additional information"]',
    continueBtnInDialog: '[role="dialog"]:has-text("Teach AI") button:has-text("Continue")',
    closeBtnInDialog: '[role="dialog"]:has-text("Teach AI") button[aria-label="Close dialog"]',
  },

  // Create project dialog (radio + Create button)
  createProjectDialog: {
    dialog: '[role="dialog"]:has-text("Create new project")',
    radio: (type: 'AI User Test' | 'AI Interview' | 'AI Survey' | 'AI Poll') =>
      `[role="dialog"]:has-text("Create new project") [role="radio"]:has-text("${type}")`,
    createBtn: (type: 'AI User Test' | 'AI Interview' | 'AI Survey' | 'AI Poll') =>
      `[role="dialog"]:has-text("Create new project") button:has-text("Create ${type}")`,
    /** Stable data-test on the dialog title — used to disambiguate from other dialogs. */
    title: '[data-test="create-project-dialog-title"]',
  },

  // Draft project dialog (shown after creating a new project)
  draftProjectDialog: {
    dialog: '[role="dialog"]:has-text("Draft project")',
    skipBtn: '[role="dialog"]:has-text("Draft project") button:has-text("Skip")',
  },

  // Project editor
  projectEditor: {
    titleInput: 'input[aria-label="Project title"]',
    questionTextarea: 'textarea[placeholder="Rating scale question here"]',
    lowLabelInput: 'input[placeholder="very bad"]',
    highLabelInput: 'input[placeholder="very good"]',
    publishBtn: 'button:has-text("Publish"):not([disabled])',
    previewBtn: 'button[aria-label*="Preview"]',
  },

  // Publish success dialog
  publishDialog: {
    dialog: '[role="dialog"]:has-text("Your project has been published")',
    // The shareable-link button wraps the survey URL inside an inner span.
    // Match either by aria-label or by any descendant whose text includes
    // `/survey/project/`. Returning the button via .locator('..') chain.
    shareableLinkBtn:
      '[role="dialog"]:has-text("Your project has been published") button[aria-label*="shareable"]',
    /** Anything inside the dialog containing the survey URL substring (URL holder). */
    shareableLinkText:
      '[role="dialog"]:has-text("Your project has been published") :text("/survey/project/")',
  },

  // Survey-taker page (public)
  survey: {
    instructionsCloseBtn: 'button[aria-label="Close"]',
    modeToggle: '[data-test="mode-toggle"]',
    questionHeading: 'h2',
    /** The question title rendered on the taker page (has a stable data-test). */
    questionTitleText: '[data-test="question-title-text"]',
    slider: '[role="slider"]',
    sendResponseBtn: 'button[aria-label="Send response"]',
    submitFormBtn: 'button:has-text("Submit the Form")',
    thankYouHeading: 'h2:has-text("Thank you")',
    /**
     * Shown when a survey URL points at a non-existent or unpublished project.
     * The app returns HTTP 200 and renders this copy — there is no 404.
     */
    expiredHeading: 'text=Oops! This Survey Link Has Expired',
  },

  // Teach AI page
  teachAi: {
    heading: 'h1:has-text("Teach AI")',
    addFileBtn: 'button:has-text("Add file")',
    addLinkBtn: 'button:has-text("Add link")',
    fileInput: 'input[type="file"]',
    // After staging a file the action button label flips from "Confirm" to "Save".
    confirmBtn: 'button:has-text("Save"), button:has-text("Confirm")',
    cancelBtn: 'button:has-text("Cancel")',

    // Data sources panel — stable data-test anchors observed in the live DOM.
    dataSourcesSection: '[data-test="teach-ai-data-sources-section"]',
    dataSourcesTitle: '[data-test="data-sources-title"]',
    dataSourcesList: '[data-test="data-sources-list"]',
    dataSourceItem: '[data-test="data-source-item"]',
    /** Match an item by visible name via its `title` attribute. */
    dataSourceItemByTitle: (name: string) =>
      `[data-test="data-source-item"]:has([title="${name}"])`,
    /**
     * The kebab/Actions menu trigger inside a specific data-source item.
     * Composes with `dataSourceItemByTitle` so we only open the menu we want.
     */
    dataSourceMenuByTitle: (name: string) =>
      `[data-test="data-source-item"]:has([title="${name}"]) [data-test="data-source-menu"]`,
    /** Item state attribute drives the UI status indicator (idle/uploading/error/...). */
    dataSourceItemState: '[data-test="data-source-item"][data-state]',
    /** Dropdown menu items shown after clicking the kebab. */
    dataSourceMenuRemove: '[role="menu"] button:has-text("Remove")',
    dataSourceMenuRefresh: '[role="menu"] button:has-text("Refresh")',
    /**
     * Removing a file pops a confirmation dialog with its own Remove button.
     * Scope the selector to the dialog so we don't re-click the menu item.
     */
    removeConfirmDialog: '[role="dialog"]:has-text("Remove file")',
    removeConfirmBtn:
      '[role="dialog"]:has-text("Remove file") button:has-text("Remove")',

    // Upload-pane structural anchors.
    //
    // The container itself renames when a file is staged:
    //   pre-stage  → data-test="teach-ai-add-file-container"      (button "Confirm", disabled)
    //   post-stage → data-test="teach-ai-add-file-uploading-container"
    //                  with button data-test="confirm-add-file-button" (text "Save", enabled)
    //
    // Anchor on the stable data-test of the action button so the visible
    // text change ("Confirm" → "Save") and the container rename are not
    // load-bearing. Text-only matching is brittle because other "Save"
    // buttons can appear elsewhere on the page once the data-source row
    // editor opens.
    addFileContainer:
      '[data-test="teach-ai-add-file-container"], [data-test="teach-ai-add-file-uploading-container"]',
    /** Action button in either container state — disabled before stage, enabled after. */
    confirmBtnTest:
      '[data-test="confirm"], [data-test="confirm-add-file-button"]',
    /** Action button once a file is staged and ready to save (text="Save", enabled). */
    saveBtnEnabled: '[data-test="confirm-add-file-button"]:not([disabled])',
    cancelBtnTest: '[data-test="cancel"], [data-test="cancel-add-file-button"]',
    /**
     * The drag-and-drop zone inside the Add File pane (the visible "Click to
     * upload" target). Clicking this opens the native file chooser. Triggering
     * the chooser via this element — instead of writing directly to the hidden
     * <input type="file"> — exercises the same React state machine a real user
     * does, so the post-save GraphQL mutation that registers the new data
     * source actually fires.
     */
    addFileDropzone:
      '[data-test="teach-ai-add-file-container"] [role="button"], [data-test="teach-ai-add-file-uploading-container"] [role="button"]',
  },
} as const;
