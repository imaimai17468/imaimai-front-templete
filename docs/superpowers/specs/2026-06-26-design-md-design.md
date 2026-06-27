# DESIGN.md — Design Specification

## Summary

Create a `DESIGN.md` at the project root that documents the design system's usage rules, principles, and constraints. Token values live in `src/styles.css`; DESIGN.md governs how those tokens are used.

Simultaneously update `src/styles.css` to implement the Wairo (和色) (和色) palette and squircle corners.

## Deliverables

### 1. `src/styles.css` — Token values

Update the existing CSS custom properties:

- **Base colors**: Shikkoku (漆黒 `#00001c`) as foreground/primary, Unohana (卯の花 `#fdfcfa`) as background
- **Neutral grays**: Not pure achromatic — light mode grays carry a warm hue bias (hue 90, from Unohana), dark mode grays carry a cool hue bias (hue 265, from Shikkoku)
- **Destructive**: Kurenai (紅) — traditional Japanese red
- **Chart colors**: 5 Wairo (和色) — Ai (藍), Wakatake (若竹), Yamabuki (山吹), Kurenai (紅), Fuji (藤)
- **Font**: `Hiragino Kaku Gothic ProN, Hiragino Sans, sans-serif`; code: `Menlo, monospace`
- **Rounded**: Collapse to 3 values — 8px (base), pill (9999px), full (9999px)
- **Squircle**: Add global `corner-shape: squircle` as progressive enhancement

### 2. `DESIGN.md` — Usage rules (no YAML front matter)

Sections:

- **Overview** — Wairo (和色) palette with squircle corners; neutrals carry subtle hue bias
- **Colors** — Semantic role rules (primary = CTA only, destructive = deletion only, etc.), dark mode inversion principle, chart color ordering
- **Typography** — Hiragino Kaku Gothic, fallback chain, Japanese typographic rules (lineHeight 1.8, letterSpacing 0.02em for body, tighter for headings, wider for labels)
- **Layout** — Spacing tier usage (xs/sm = intra-component, md/lg = inter-component, xl/2xl/section = page structure)
- **Shapes** — 3 rounded values only (8px / pill / full), squircle via `corner-shape: squircle` with progressive enhancement
- **Components** — shadcn/ui (new-york) base, button variant usage rules, card/input conventions
- **Do's and Don'ts** — 7 each, covering color usage, dark mode, spacing, rounded values, component patterns
- **Iteration Guide** — 5 rules for agents editing the design system (values in styles.css, rules in DESIGN.md)

## Design Decisions

1. **No YAML front matter** — Token values belong in `styles.css` (single source of truth). DESIGN.md documents rules, not values.
2. **oklch color format** — Matches existing styles.css, enables perceptually uniform color manipulation.
3. **Hue-biased neutrals** — Pure achromatic grays (`oklch(x 0 0)`) are explicitly forbidden. Light grays carry Unohana's warmth (hue 90), dark grays carry Shikkoku's coolness (hue 265).
4. **3 rounded values** — 8px / pill / full. No intermediate values. Enforced in Do's and Don'ts.
5. **`corner-shape: squircle`** — Progressive enhancement. Chromium 139+ gets superellipse corners; Firefox/Safari fall back to standard border-radius. No polyfill, no SVG hack, no external dependency.
6. **Hiragino Kaku Gothic** — macOS/iOS native. Other platforms fall back to Hiragino Sans → system sans-serif. No web font loading.
7. **Japanese typographic rules** — Body lineHeight 1.8 (wider than Western 1.5–1.7), letterSpacing 0.02em for body, -0.02em–0 for headings, 0.04em for labels/captions.
8. **Elevation/Responsive omitted** — Shadows use shadcn defaults (shadow-sm). Responsive uses Tailwind standard breakpoints. No custom definitions needed.
9. **All documentation in English** — Per AGENTS.md policy for agent-facing docs.

## Out of Scope

- Web font loading or font file embedding
- External dependencies (`@google/design.md`, CSS libraries)
- Custom grid system
- Animation / motion guidelines
- Figma / design tool integration
