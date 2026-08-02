# Awaiting fixes

Things noticed during the V1.1 pass (and the follow-up Impeccable critique/audit/polish
pass) that weren't fixed now — either too minor to justify the churn, too large to do
as a drive-by, or need a decision from you first.

## Deferred — real critique findings, out of bounded-pass scope

- **Zero responsive layout below ~768px.** Confirmed live at a 390px viewport: the
  sidebar is a hardcoded `width: 240px; flex-shrink: 0`, which leaves `<main>` only
  ~150px wide. Stat labels, MC option text, and whole panels (Import, DocumentGeneration)
  visibly clip. There are no `@media` breakpoints anywhere in the codebase except
  `prefers-reduced-motion`. Fixing this properly means a real redesign pass (collapse
  sidebar to a top bar/drawer under some breakpoint, let grids/option lists reflow) —
  too large for a bounded polish pass. For now this is desktop-only by decision,
  documented in DESIGN.md's Layout section. Revisit if you ever want to use this on
  a phone between classes.
- **No keyboard path through the drilling loop.** MC options are visually labeled
  `[a] [b] [c] [d]` (implying keyboard input) but there's no keydown handler wiring
  letter keys to option selection, and no shortcut for "next question." Short-answer
  already supports Enter-to-submit. If you drill a lot, wiring `a`/`b`/`c`/`d` and
  `Enter`-on-feedback to advance would remove a lot of mouse travel.
- **Disabled-button contrast — reviewed, no change made.** The detector/audit flagged
  that disabled buttons differ from enabled ones only by `opacity: 0.4` (no color/border
  change). WCAG explicitly exempts disabled controls from contrast requirements, and
  opacity + `cursor: not-allowed` is a standard pattern, so this was left as-is rather
  than treated as a defect.

## Minor / cosmetic

- **Native `<select>` chrome.** Subject/mode/answer-type dropdowns in the manual
  Import form use the browser's default `<select>` styling (system font rendering
  inside the closed box is fine — it's inherited — but the dropdown arrow and the
  open popup list are unstyled OS chrome). Fully theming a `<select>` popup means
  either `appearance: none` + a custom SVG arrow + accepting the open-list can't be
  restyled cross-browser, or swapping to a listbox component. Left as native for now
  since it's functional and only visible for ~1 second per interaction.
- **DocumentGeneration empty states are sparse.** The 240px template list column
  is just a lone "new template" button until you've saved a few templates — fine
  once you have real templates in there, a little bare on first run.
- **Slashed zero.** Space Mono's bold `0` glyph has a slash through it (a coding-font
  convention to disambiguate from letter O). It shows up in the round badge and stat
  tiles. Intentional font behavior, not a bug — flagging in case you'd rather it read
  as a plain oval zero.

## Needs a decision

- **Manual entry `fuzzyTolerance`.** The manual short-answer form exposes `type`,
  `value`, and (implicitly) the defaults for `caseSensitive`/`requireAll`, but not
  `fuzzyTolerance` — every manually-entered acceptable answer gets `"auto"`. JSON
  import still supports setting it explicitly. Add a field if you want manual cards
  to control tolerance too.
- **No import round preview/undo.** Both JSON and manual import archive the
  subject's prior active MC/SA pool as soon as you hit "run import" — there's no
  "are you sure" or dry-run step. This matches the existing spec behavior (§5), just
  noting it applies to the new manual path too.

## Not verified (couldn't test in this pass)

- **PDF generation end-to-end.** Confirmed the `[^name^]` placeholder swap compiles
  through the same regex/substitution path as before, and the UI renders the new
  token correctly, but didn't run an actual XeLaTeX compile in the headless browser
  session (WASM engine + 71MB of TeX Live assets — slow to boot repeatedly, and
  clipboard/file-save behavior differs headless vs. real Chrome). Worth a manual
  click-through before you rely on it.
- **Clipboard buttons in a real browser.** "copy format instructions" (Import) and
  "export drafts" (Review Prac) both use `navigator.clipboard.writeText`, which
  needs a permissions prompt in real Chrome the first time. Not exercised headless.
- **Impeccable's `live` (pinpoint-feedback) mode.** Still not run — it needs a
  connected browser extension for live in-page picking, which isn't available in
  this environment. `critique`, `audit`, and `polish` were all run for real this
  time (two isolated sub-agents for critique's dual assessment, the bundled
  `detect.mjs` scanner, and a headless-Chromium evidence pass); see
  `.impeccable/critique/` for the persisted report.
