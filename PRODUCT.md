# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite. Builds to static assets, deployed to Cloudflare Workers via wrangler.

## Users

Single user (the person who commissioned this app), studying for VCE-style exams across six fixed subjects: Sci-thinking, Science, Maths, English, History, Geography. Personal tool — not designed for a stranger landing on it cold, no multi-account/auth layer needed.

## Product Purpose

A local-first revision app that replaces scattered documents with one place to drill multiple-choice and short-answer questions (auto-graded, fuzzy-matched), draft extended "Review Prac" responses, and generate filled-in LaTeX documents from reusable templates — all without a backend or account. Success is faster, lower-friction revision cycles across rounds of imported questions, with full attempt history retained for future spaced-repetition scheduling.

## Positioning

Everything lives in the browser's IndexedDB — no server, no login, no data leaving the device except when the user deliberately copies a Review Prac export to paste into an LLM for marking. Question banks are refreshed by re-import (old MC/SA questions archive, not delete, so history survives); Review Prac and Document Generation both treat LaTeX/plain text as the native format for output, not an afterthought. Document Generation renders PDFs from XeLaTeX entirely client-side via WASM — no server round-trip for compilation either.

## Operating Context

- Import rounds: the user pastes/imports a JSON batch of questions per subject; this archives that subject's prior active MC/SA pool and increments a global round counter.
- Practice sessions: multiple-choice and short-answer questions are answered and auto-graded on the spot; every attempt is logged permanently.
- Review Prac: long-form answers are typed and autosaved as drafts, then exported as a formatted plain-text bundle (for pasting into an external LLM for marking) and can be reopened later for another attempt.
- Document Generation: the user pastes a LaTeX template containing `[^placeholder^]` tokens, fills in the dynamically-derived input fields, and generates a downloadable PDF rendered locally via a WASM XeLaTeX engine.
- Import: alongside JSON paste, a manual card-entry form builds the same subject/question payload without writing JSON by hand.

## Capabilities and Constraints

- Six fixed subjects, each with a fixed set of supported modes (multipleChoice / shortAnswer / reviewPrac) — not user-configurable.
- Storage is IndexedDB only; no backend persistence, no network calls required for core functionality.
- Short-answer grading uses normalization + exact/regex/keyword matching with a Levenshtein fuzzy-tolerance curve.
- Document Generation's XeLaTeX-in-WASM engine only has access to fonts bundled in its own TeX Live package image — no arbitrary system font loading via fontspec.
- Full backend/data-logic contract is specified in `revision-app-backend-spec-2.md` in this repo; treat it as binding for schema, grading, storage, and rendering-pipeline decisions.

## Brand Commitments

None established yet — no existing name, logo, or visual identity to preserve.

## Evidence on Hand

No real question banks, templates, or sample exports on hand yet. Sample shapes exist only as illustrative JSON in the backend spec (e.g. a derivative-of-sin(x) Review Prac question, a chain-rule short-answer question) — these are schema examples, not real content, and should not be treated as representative of actual exam material.

## Product Principles

1. Local-first, always: nothing about the design should imply a server, account, or sync that doesn't exist.
2. History is sacred: archiving, autosave, and export-then-reopen flows exist so past work is never silently lost — the UI should reflect that durability, not undercut it.
3. Built for one honest user, not a crowd: copy and empty states can be direct and first-person rather than generically welcoming.
4. Rounds are the heartbeat: import rounds are the app's natural rhythm (fresh MC/SA pool, same durable history) — the UI should make "what round am I in, what's new" legible at a glance.
