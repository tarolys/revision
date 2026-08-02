# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`revision.log` — single-user, local-first VCE revision app (React + Vite, deployed as static assets to Cloudflare Workers via wrangler). No backend, no auth, no network calls for core functionality. All data lives in IndexedDB in the browser.

Root-level docs are the source of truth, not this file:
- `PRODUCT.md` — product purpose, users, principles.
- `DESIGN.md` — full design system (colors, type, layout, components, do's/don'ts). Read before touching any styling.
- `revision-app-backend-spec-2.md` — **binding** data model, storage, grading, import/export, and PDF-generation contract. Treat as spec, not reference.
- `awaiting_fixes.md` — known gaps/deferred issues (no responsive layout, no keyboard nav in drilling loop, etc.) — check before "fixing" these as new bugs.

All actual application code lives under `app/`.

## Commands (run from `app/`)

- `npm run dev` — starts Vite dev server (auto-runs `xelatex:assets` first via `predev`)
- `npm run build` — `tsc -b && vite build` (auto-runs `xelatex:assets` first via `prebuild`)
- `npm run lint` — oxlint
- `npm run preview` — preview built output
- No test suite configured.

`xelatex:assets` copies the XeLaTeX WASM engine + TeX Live assets into `public/xelatex` via `thtex`; this is why dev/build are slow to start the first time.

## Architecture

### Six fixed subjects, three modes

Subjects (`sciThinking`, `science`, `maths`, `english`, `history`, `geography`) and which modes each supports (`multipleChoice` / `shortAnswer` / `reviewPrac`) are hardcoded app config, not user-editable — the matrix is in `revision-app-backend-spec-2.md` §1. Import validation rejects any question whose mode isn't in its subject's list.

### Data layer (`src/lib/db/`, `src/lib/types.ts`)

IndexedDB via `idb`, single DB (`revision-app`) opened through `getDB()` in `schema.ts`. Stores: `questions`, `attempts`, `reviewPracAnswers`, `reviewPracExportHistory`, `meta`, `documentTemplates`, `documentFieldDrafts`. Per-store helpers live in sibling files (`attempts.ts`, `documents.ts`, `questions.ts`, `reviewPrac.ts`).

Key behavioral rules baked into the schema (see backend spec §2, §5.4, §6.3 for full detail — don't reimplement from first principles):
- **Import replaces, never accumulates**: importing a subject archives (not deletes) its previously-active MC/SA questions and bumps the global `currentRound` counter. Attempt history is untouched by archiving.
- **Attempts are append-only**: one row per submission, never overwritten. Stats (accuracy, streaks, etc.) are always derived on read from `attempts`, never cached/stored redundantly.
- **Review Prac answers are mutable + autosaved** (debounced ~500ms), the opposite of attempts. Exporting snapshots the current answer into `reviewPracExportHistory` and flips status to `exported`; reopening flips back to `draft` without clearing the text.
- **Document templates** derive their input-field list live via regex over `latexSource` (`[^field_name^]` tokens) — field count/list is never stored independently of that derivation. Field drafts reconcile against the current placeholder list on every template edit (matching names kept, missing ones deleted, new ones created empty).

### Grading (`src/lib/grading/`)

- MC: direct `selectedOptionId === correctOptionId`.
- SA (`gradeShortAnswer.ts`): normalize both sides (trim/lowercase/strip punctuation except `+ - * / = ^ . ° %`/collapse whitespace), then try each `acceptableAnswers` entry in order (`exact` | `regex` | `keywords`) — first match wins. Fuzzy tolerance is Levenshtein-based (`levenshtein.ts`) on a length-scaled curve (0 tolerance ≤3 chars, up to 3 for 11+ chars) unless overridden per-answer. `regex` type skips normalization entirely and matches raw trimmed input.
- Review Prac: no grading, just captured text for later export/manual marking.

Full grading contract is spec §4 — consult it before changing matching behavior.

### Document generation (`src/lib/document/`)

`placeholders.ts` extracts `[^field_name^]` tokens (regex `/\[\^([A-Za-z0-9_]+)\^\]/g`); `compiler.ts` drives the XeLaTeX-in-WASM pipeline (lazy-loaded on first use, runs in a Web Worker, second compile pass on "rerun for cross-references" notices). Generated PDFs are never persisted — object URL, offered as download, revoked after. This is spec §7.

### UI structure (`src/pages/`, `src/components/`)

One page per `View` in `src/lib/navigation.ts` (`dashboard`, `practice`, `reviewPrac`, `import`, `documentGeneration`), each with a co-located `.module.css`. Shared chrome components (`TerminalFrame`, `Sidebar`, `StatusBadge`, `SessionLogLine`, etc.) implement the terminal/instrument-console design system described in `DESIGN.md` — read that file before adding or restyling any component; it has explicit named rules (e.g. never put long-form reading content in monospace, amber is the only saturated accent, no shadows anywhere).

Layout is desktop-only by deliberate decision (no responsive breakpoints) — see `awaiting_fixes.md` before adding any.

## Deployment

`wrangler.jsonc` — static asset deployment (`dist/`) to Cloudflare Workers, custom domain `revision.yippfoxx.cc`, no server-side Worker logic.
