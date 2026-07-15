# Top Page Redesign — Document-Style

- Date: 2026-07-15
- Status: approved
- Approach: A (Document-style)

## Goal

Redesign the template's top page as a minimal, tool-like README-in-the-browser.
The primary audience is developers who fork the template and want to understand
what's included and how to start.

## Anti-slop rationale

The current page violates several anti-slop-design rules:
- The default hero stack (h1 / description / 2-button pair)
- The filled-button-next-to-outlined-button pair (GitHub + Docs)
- Icon-topped 3-column feature cards (6 identical Tech Stack cards)
- Dead controls (button variants, icon grids with no function)
- Kitchen-sink design-system exhibition (colors, typography, corners, chart
  colors, icons — all as static display with no interactivity)

## Design

### Structure (3 blocks, top to bottom)

1. **Header** — Template name (`imaimai-front-template`) in `text-2xl
   font-medium`. One line of description below. One GitHub text link (not a
   button pair).

2. **Get Started** — Shell commands in a single code block:
   `git clone`, `cd`, `cp .env.local.example`, `bun install`, `bun run dev`.
   Below it, one sentence:
   "Edit `src/routes/index.tsx` to start building." No Card wrapper.

3. **Stack & Design** — Tech Stack as an inline text list separated by `·`
   (no cards). Below it, the 5 base-palette color swatches in a single
   compact row (squircle swatch + Japanese name, no role label).

### Removed

- Lucide icon imports and exhibition
- Button variant grid
- Typography samples
- Chart colors section
- Corner shape comparison (3-element row)
- "Get started" Card wrapper
- 2-button CTA pair (GitHub + TanStack Start Docs)

### Motion

Minimal per motion-craft philosophy (frequency: this page is seen every dev
session — tens/day or more, so reduce or remove animation):
- Header sticky blur (already exists, keep)
- Dark mode toggle transition (already exists, keep)
- No entrance animations, no hover lifts, no stagger

### Typography

Use existing system fonts (Hiragino Kaku Gothic ProN / Menlo). No additional
fonts loaded.

### Colors

Use existing Wairo design tokens only. No new colors. The hue-biased neutrals
(warm in light, cool in dark) carry the Japanese-color identity through the
page's ambient tone — no explicit gradient or color flourish needed.

## Acceptance criteria

- Page loads with zero layout shift
- No dead controls (everything visible is either informational text or a
  working link)
- No anti-slop-design violations
- Dark mode works correctly
- Responsive (mobile / desktop)
- TypeScript compiles, lint passes, tests pass
