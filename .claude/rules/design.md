---
description: Design system, covering the Wairo (和色) palette, squircle corners, typography, spacing, and component conventions
globs: src/**/*.css,src/**/*.tsx
alwaysApply: false
paths: src/**/*.css, src/**/*.tsx
---

# Design System

## Overview

A design system rooted in Japanese traditional colors (和色). Every neutral
carries a subtle hue bias: warm in light mode, cool in dark mode. There are
no pure achromatic grays.

All rounded corners use `corner-shape: squircle` for superellipse curves.
Browsers that do not support this property fall back to regular `border-radius`.

Token values are defined in `src/styles.css`. This document governs how those
tokens are used.

## Colors

### Semantic Roles

- **primary**: Main actions. Never as a background fill.
- **secondary**: De-emphasized actions.
- **muted / muted-foreground**: Helper text, placeholders, disabled states.
- **accent**: See Accent Color below.
- **destructive**: Deletion and error actions only. Not for general warnings.
- **border / input**: Structural separation. Subtle, never dominant.

### Accent Color

Accent is one hue applied consistently to a chosen category of elements.
Pick which element types carry accent, then apply it to ALL instances of
that type, never selectively. Mixing strategies (some links colored, some
not) reads as inconsistency rather than design.

- Match the accent's undertone to the neutral palette. Cool neutrals pair
  with cool accents, and cross-temperature creates tension.
- Derive hover/active variants by adjusting lightness, never by picking new
  colors.
- Accent is independent of destructive. Never use the accent hue for errors
  or warnings.
- On landing pages, accent also appears in brand visuals (logo, hero,
  illustrations). On app UIs, accent stays on interactive elements only.

### Color Usage Rules

- Never rely on color alone to convey state. Always pair it with shape, icon,
  or text.
- When deriving hover/disabled/active variants, verify contrast against
  WCAG AA (4.5:1 for text, 3:1 for UI elements). Perceptually uniform color
  spaces do not exempt you from contrast checking.
- Keep distinguishable gray shades to a minimum, because too many similar
  grays make contrast between adjacent surfaces indistinguishable.
- Use semantic token names in components, never a raw color value.

### Dark Mode

Dark mode is a paired color scale rather than a separate system. When adding
a new token, define both light and dark values together. Never invert hex
values directly, because that shifts hues. Adjust lightness while preserving
chroma and hue. Token switching carries the whole scheme, so no component
branches on the mode.

Pure white on dark backgrounds causes eye strain. Use the hue-biased
off-white defined in `src/styles.css`.

### Chart Colors

Chart colors are defined in `src/styles.css` in a fixed order. Assign data
series in that order.

## Typography

### Fonts

Font families are defined in `src/styles.css`. The body font and monospace
font are chosen as a pair, matching stroke weight and proportions.

### Typographic Rules

- Body text needs wider line-height than Western text (Japanese characters
  are taller and denser).
- Body letter-spacing is slightly open (not solid-set).
- Heading letter-spacing is tighter (feels more composed at large sizes).
- Label and caption letter-spacing is wider (for scannability).

### Typographic Pitfalls

- Limit to 2 typefaces max (body + code).
- Keep body text line length under ~75 characters.
- Never center-align multi-line paragraphs.
- Maintain a clear typographic hierarchy. Where two text elements look the
  same weight and size, one of them is wrong.
- Font metrics (ascent/descent) create phantom padding that differs between
  design tools and browsers.

## Layout

### Spacing Tiers

Spacing follows defined tiers in `src/styles.css`. Use the right tier for
the right context: smallest for intra-component gaps, medium for
inter-component, largest for page structure.

### Spacing Rules

- Use parent `gap` (flex/grid), never per-element `margin`. Per-element
  margins collapse, double up, and require CSS changes when elements are
  removed.
- Never mix spacing scales in the same layout.
- `padding` is internal space, and `margin` is external space. Don't swap
  them.
- When line-height contributes to vertical rhythm, account for it in padding
  calculations, because the visual gap is line-height plus padding rather
  than padding alone.
- Don't add padding to a child when the parent already provides it. Read the
  parent's styles before adding spacing to children, since doubling padding
  is a common cause of uneven gaps. External examples and copy-paste snippets
  often assume a different parent context, so always verify against the
  actual component you're composing into.

## Shapes

### Rounded Corners

Radius values are defined in `src/styles.css`. Do not introduce values outside
the defined set.

### Squircle

`corner-shape: squircle` is applied globally. This produces superellipse
curves instead of standard circular arcs. Unsupported browsers fall back
to standard `border-radius`, which is acceptable.

## Elevation

Hierarchy and separation come from background color difference, border,
spacing, and typography, never from shadow.

Shadow is limited to two cases:
- **Drag state**: the element being dragged gets shadow to communicate
  "lifted off the surface." Remove on drop.
- **Sticky header on scroll**: shadow appears dynamically when content
  scrolls beneath a sticky element. No shadow at rest.

Everything else uses border or backdrop dim for separation.

## Interaction & Content

### Interactive States

Every interactive element must define all five states: default, hover,
focus-visible, active, and disabled. A hover state is not optional. Focus
must be visible, so never remove the focus indicator.

Touch targets must be at least 44px × 44px. If the visual element is smaller,
expand the hit area with padding or a transparent pseudo-element.

Limit primary actions to one per screen. Require a confirmation step before
destructive actions. Labels belong outside input fields (no floating labels).

### Content States

Every data-displaying component must account for: loading, empty (zero
results), error, and populated states. Loading must show a visible indicator
rather than a blank screen. Error messages must identify what went wrong and
what the user can do.

### Dynamic Content

Design for variable-length content. User names, titles, descriptions, and
translations will overflow, truncate, or wrap. Test every text container with:
- Single-character input
- Maximum-length input (or a long unbroken string)
- Multi-line overflow

Containers that accept user-generated text need explicit word-break handling.

## CSS Architecture

### Sizing

Prefer `max-width` and `min-width` over fixed `width`. Prefer `min-height`
over fixed `height`. Components should flex with content rather than fight it.

### Overflow

`overflow: hidden` clips everything: shadows, positioned children, focus
outlines. Use it only when clipping is the explicit intent, never as a layout
shortcut.

### Specificity

Avoid over-targeting selectors. `z-index` only works on positioned, flex,
or grid children, never on elements in normal flow.

### Cross-browser

- Button default backgrounds differ across browsers. Always set `background`
  explicitly on buttons.
- `transparent` renders as `rgba(0,0,0,0)` in some browsers' gradients. Use
  the actual color with alpha 0 instead.
- `auto-fill` and `auto-fit` in CSS Grid behave differently with leftover
  space.
- Inline elements create phantom spacing between siblings. Use `flex` or
  `grid` on the parent to eliminate it.

### Animations

Animate `transform` and `opacity` only, never layout properties, which
trigger reflow on every frame.

## Decoration

Don't produce AI-generated design clichés. Common tells include: colored
left/top border stripe on cards, purple-to-blue gradient backgrounds, gradient
text on headings, serif italic on a single hero word, numbered steps
(01/02/03) on non-sequential content, badge/eyebrow above H1 with no
informational purpose, icon-topped 3-column feature cards, vague aspirational
headlines, everything centered, uniform border-radius on all elements,
glassmorphism without function, emoji in navigation, cards wrapping
everything, big-number stat banners as filler. If a decoration doesn't encode
real information, remove it.

## Iteration Guide

1. To change token values, edit `src/styles.css`. Never write token values
   in this file.
2. When adding a new semantic color, add both light and dark values together.
3. Do not introduce radius values beyond the defined set.
4. This file describes **why** and **when**. `src/styles.css` defines
   **what** (values).
