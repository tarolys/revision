---
name: revision.log
description: A personal amber-phosphor terminal for VCE exam revision.
colors:
  ground: "#050604"
  panel: "#0d0f0c"
  panel-raised: "#171a15"
  inset: "#020302"
  amber-dim: "#96660a"
  amber: "#ffb000"
  amber-bright: "#ffd166"
  ink: "#ece9e2"
  ink-dim: "#a8a49a"
  ink-faint: "#6b675e"
  good: "#35d999"
  bad: "#ff4d52"
  line: "#383b32"
typography:
  chrome:
    fontFamily: "Space Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontWeight: 700
    fontSize: "0.75rem–0.95rem"
    letterSpacing: "0.02em–0.05em"
  body:
    fontFamily: "IBM Plex Sans, -apple-system, Segoe UI, sans-serif"
    fontWeight: 400
    fontSize: "0.95rem–1.05rem"
    lineHeight: 1.55–1.6
rounded:
  sm: "2px"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  5: "1.5rem"
  6: "2rem"
  8: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ground}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.amber-bright}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
---

# Design System: revision.log

## Overview

**Creative North Star: "The Personal Terminal"**

revision.log reads as a private command-line study console — the kind of instrument a single, serious user runs for themselves, not a product built to be legible to a stranger landing on it cold. Everything about the system says "logged, appended, never silently lost": rounds append to a session log rather than replacing anything, attempts stack rather than overwrite, and even Review Prac's export-then-reopen cycle behaves like a coupon being validated, not deleted. The amber-phosphor palette borrows from scientific and aviation instrument consoles rather than the more clichéd green Matrix-terminal look, keeping the system distinctive rather than a costume.

Reading comfort was a deliberate, explicit constraint on top of the world: monospace carries structure (navigation, labels, round badges, timestamps, status pills, and anything that is literally code — regex, LaTeX source) but never the content someone has to read at length. Question prompts, Review Prac answers, and rubric context all render in a plain humanist sans so a real study session doesn't fight its own chrome.

**Key Characteristics:**
- Near-black ground with a single committed amber accent — never diluted into a rainbow of UI colors
- Monospace for structure and code, humanist sans for anything read at length
- Append-only, log-style presentation of history (session log, attempt history, round badges)
- Flat surfaces, hairline borders, no shadows — depth comes from tonal steps, not elevation

## Colors

A near-black ground carries one committed amber accent at 30–60% of any given screen's chrome; green and red are reserved strictly for grading semantics and never used decoratively.

### Primary
- **Phosphor Amber** (`#ffb000`): the system's one voice — borders, active nav state, round badges, primary buttons, the blinking cursor, focus rings. Historic instrument-console amber (Tektronix/DEC-style), not the more expected green terminal cliché.
- **Amber Bright** (`#ffd166`): hover/active state for amber elements, and emphasis inside otherwise-dim text.
- **Amber Dim** (`#96660a`): resting borders and secondary nav glyphs — amber present but quiet, brightened slightly from the original spec so it still reads against the darker ground.

### Neutral
- **True Ground** (`#050604`): page background — pushed near-true-black for a stronger instrument-console feel and more contrast against the amber accent.
- **Panel** (`#0d0f0c`) / **Panel Raised** (`#171a15`): sidebar and title-bar surfaces, one step up from ground.
- **Inset** (`#020302`): recessed surfaces — text inputs, textareas, anything "typed into."
- **Ink** (`#ece9e2`): primary reading text — a pale, slightly warm off-white, never full cream/beige as a surface color.
- **Ink Dim** (`#a8a49a`) / **Ink Faint** (`#6b675e`): secondary and tertiary text, timestamps, placeholder copy.
- **Line** (`#383b32`): hairline borders throughout.

### Semantic (grading only)
- **Good** (`#35d999`): correct answers, active/draft status.
- **Bad** (`#ff4d52`): incorrect answers, destructive actions.

### Named Rules
**The One Voice Rule.** Amber is the only saturated brand color in the system. Green and red exist solely to report grading truth (correct/incorrect, draft/exported) — they never decorate a button or a nav item that isn't reporting a grading state.

## Typography

**Chrome/Structure Font:** Space Mono (with ui-monospace, SFMono-Regular, Menlo, Consolas fallback)
**Body Font:** IBM Plex Sans (with system-ui, Segoe UI fallback)

**Character:** Space Mono gives every structural element — nav, round badges, timestamps, status pills, and literal source (regex, LaTeX) — the flat, fixed-width authority of a terminal. IBM Plex Sans exists purely so nothing the user has to actually *read* — a question prompt, a Review Prac paragraph, rubric context — fights the chrome around it.

### Hierarchy
- **Chrome/Label** (700 weight, 0.7–0.85rem, tight letter-spacing): nav items, round badges, section headers, timestamps, status badges. Always monospace, always uppercase where it reads as a label.
- **Body** (400 weight, 0.95–1.05rem, 1.55–1.6 line-height): question prompts, Review Prac answers, rubric/context text. Always the sans face; 65–75ch measure where the layout allows.
- **Code** (400 weight, 0.85rem monospace, `white-space: pre`): LaTeX template source, raw JSON import payloads.

### Named Rules
**The Read-vs-Scan Rule.** If a user is expected to *read* it (an answer, a prompt, a rubric), it's sans. If a user is expected to *scan* it (a label, a timestamp, a status), it's mono. Content is never mono for the sake of theming alone.

## Layout

Two-column shell: a fixed 240px sidebar (subject switcher + command nav + round badge) and a flexible main column capped at 1180px so panels use a wide desktop viewport instead of leaving it empty. Individual reading-width elements (question prompts, Review Prac answers, MC/SA answer controls) cap themselves narrower — 64–76ch — inside that wider shell, so prose and forms still never stretch past a comfortable reading measure. Content areas use `TerminalFrame` panels — a titled box with a `$ command` header bar — as the one repeating structural unit across every screen. Spacing follows an 8px-rooted scale (0.25rem steps up to 3rem) applied consistently for panel padding, form field gaps, and section breaks. The layout is desktop-only by design (no responsive breakpoints); see `awaiting_fixes.md` if that scope ever needs to change.

## Elevation & Depth

Flat by design — no box-shadows anywhere in the system. Depth is conveyed entirely through tonal steps (ground → panel → panel-raised → inset) and hairline borders, consistent with a terminal/instrument-panel world where surfaces sit at the same physical depth and are distinguished by their material, not by simulated lighting.

### Named Rules
**The Flat-By-Default Rule.** No shadows, ever. A surface reads as "raised" only by moving one step up the ground→panel→inset tonal ladder, never by adding blur.

## Shapes

Sharp, near-rectangular geometry throughout: a single 2px corner radius system-wide (buttons, inputs, panels, badges), 1px hairline borders, and box-drawing-inspired framing (the `TerminalFrame` title bar) rather than card shadows or pill shapes. Status badges render as bracketed text (`[DRAFT]`, `[ARCHIVED]`) rather than colored dots or rounded chips — the terminal's own vocabulary for state.

## Components

### Buttons
- **Shape:** 2px radius, 1px border, monospace label prefixed with a literal `> ` glyph.
- **Primary:** solid amber background, near-black text, used once per screen for the one committed action (submit, generate, run import).
- **Ghost:** transparent background, dim border, amber-bright on hover — the default for secondary actions (next question, reopen, cancel).
- **Danger:** transparent with a red border/text, reserved for destructive-leaning actions.

### Inputs / Fields
- **PromptInput** (single-line): inset background, `>` glyph prefix, amber border on focus — styled as a single command-line entry.
- **TextArea** (`prose` variant): sans-serif, generous line-height, for anything read at length (Review Prac answers).
- **TextArea** (`code` variant): monospace, `white-space: pre`, for LaTeX/JSON source.
- **Focus:** border shifts to full amber; no glow or ring.

### Status Badges
- **Style:** bracketed monospace text (`[ACTIVE]`), color-coded by tone (amber/good/bad/dim) — never a colored pill or dot.

### Navigation (Sidebar)
- **Style:** monospace nav items prefixed with a dim amber `$`, brightening to amber-bright with a soft amber wash background when active. Round badge renders as a bracketed amber pill (`ROUND 04`) beneath the brand mark.

### Session Log Line (signature component)
- Three-column monospace row (round / time / label) with a dotted divider — the direct visual expression of "history is sacred, append-only." Used for both the dashboard's recent-activity feed and each question's own attempt history.

## Do's and Don'ts

### Do:
- **Do** keep amber as the only saturated chrome color; let green/red appear only for grading truth.
- **Do** render question prompts, Review Prac answers, and rubric context in IBM Plex Sans, never monospace.
- **Do** use the bracketed-label style (`[DRAFT]`, `ROUND 04`) for any status or count that the terminal world would show as text, not an icon.
- **Do** keep the single 2px radius and flat, shadow-free surfaces system-wide.

### Don't:
- **Don't** put long-form reading content in monospace — confirmed explicitly during direction review; the terminal chrome must never cost legibility.
- **Don't** introduce a second saturated accent color (no blue, purple, cyan, or pink) — amber carries the whole system.
- **Don't** add box-shadows, gradients, or glassmorphism — depth comes from the tonal ladder only.
- **Don't** use cream, beige, or warm-paper tones as a surface color — the ground is near-black, full stop.
