---
description: Design system, covering color roles, typography, spacing, shapes, composition, and component conventions
globs: src/**/*.css,src/**/*.tsx
alwaysApply: false
paths: src/**/*.css, src/**/*.tsx
---

# Design System

## Overview

Token values are defined in `src/styles.css`: shadcn/ui's neutral base, kept
achromatic for every surface and text role, with a hue only on `destructive`
and the chart series, and a radius scale derived from `--radius`.
That base is a starting point rather than an identity, so a project that wants a
palette, a typeface, or a corner treatment of its own replaces the values there
and leaves the rules below alone.

This document governs how those tokens are used.

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
- Apply the accent as a value step, usually desaturated, rather than as a
  saturated fill. Where every accent on a screen is the same vivid swatch,
  the screen reads as a template.
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
- A label on a filled surface clears its fill by a real value gap. A dim tint
  of the fill color, or ink close in value to the surface behind it, leaves
  text the reader has to fight for.
- Use semantic token names in components, never a raw color value.
- Give a large surface one tone, and put headline emphasis in weight, scale, or
  a value step. A gradient blended across a background or poured into type
  reads as unchosen whichever pair of hues it takes, and blue into purple is
  the pair that arrives by default.

### Dark Mode

Dark mode is a paired color scale rather than a separate system. When adding
a new token, define both light and dark values together. Never invert hex
values directly, because that shifts hues. Adjust lightness while preserving
chroma and hue. Token switching carries the whole scheme, so no component
branches on the mode.

Pure white on dark backgrounds causes eye strain. Use the off-white
`--foreground` defined in `src/styles.css`.

Declare `color-scheme` in each mode alongside the tokens, so the browser paints
the scrollbars, the native controls, and the caret in the same mode.

### Chart Colors

Chart colors are defined in `src/styles.css` in a fixed order. Assign data
series in that order, and give each series a second cue beyond hue, such as a
marker shape, a dash pattern, or a direct label.

## Typography

### Fonts

`src/styles.css` does not override `--font-sans` or `--font-mono`, so Tailwind's
system stacks apply. A project that picks its own defines the body family and
the monospace family there together, matching stroke weight and proportions.

Where a project takes a display face, choose it for this product and self-host
it, with one neutral family under it for body text. `system-ui` is a genuine
neutral, so it belongs under a display face rather than carrying one.

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
- Set monospace where the content is data: a timestamp, a code, a price, a
  table. Captions, labels, and running copy take the body family.
- Give the small text roles different treatments. Where the eyebrow, the button
  label, the caption, and the footer line all wear the same tracked-out caps,
  the screen reads as a template instead of a voice.
- Set `font-variant-numeric: tabular-nums` where numbers line up for
  comparison, so the digits keep their columns.
- Keep a mobile input at 16px or larger, because iOS Safari zooms the page for
  anything smaller.
- Type the real characters: `…`, curly quotes, and a non-breaking space inside
  a measurement or a key combination.
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
- Respect the safe areas with `env(safe-area-inset-*)` where a fixed or
  full-bleed element reaches the viewport edge.
- Don't add padding to a child when the parent already provides it. Read the
  parent's styles before adding spacing to children, since doubling padding
  is a common cause of uneven gaps. External examples and copy-paste snippets
  often assume a different parent context, so always verify against the
  actual component you're composing into.

### Alignment

- Put parallel items on one grid, so the title, the body, and the control share
  a line across every column. Give the columns equal height, anchor the control
  to the bottom of each, and hold the slot of a value that is missing in one
  column. Copy length then stops deciding where a neighbor's content lands.
- Verify what the design centers rather than eyeballing it. In SVG,
  `text-anchor: middle` sets the horizontal alone, `dominant-baseline: central`
  or a measured `dy` sets the vertical, and a rotated, stroked, or padded shape
  moves where the center is.
- Give text a gutter from every edge it nears, and keep those gutters equal. A
  line that reaches the rim of its container reads as overflow.

## Shapes

Every radius tier derives from `--radius` in `src/styles.css`. Pick the tier
that matches the element's size, and do not introduce values outside the
defined set.

Nest radii by subtracting the gap. An inner radius equals the outer radius minus
the padding between them, and where both take the same value, the two curves
stop running parallel at the corner.

## Elevation

Hierarchy and separation come from background color difference, border,
spacing, and typography, never from shadow.

Shadow is limited to two cases:
- **Drag state**: the element being dragged gets shadow to communicate
  "lifted off the surface." Remove on drop.
- **Sticky header on scroll**: shadow appears dynamically when content
  scrolls beneath a sticky element. No shadow at rest.

In those two cases, cast the shadow from one direction with a small offset and
a small blur, tinted to the surface or to the element's own color. A bloom
spread evenly on all sides, or a second box placed behind the element to imitate
one, reads as a sticker rather than a lit object.

Everything else uses border or backdrop dim for separation. Where a container
needs an edge, shift its surface a step from the background and stroke it with
its own color at low opacity, which keeps border, shadow, and text on one hue.

A translucent surface needs a backdrop worth showing through and a blur that
blends at every edge. Where the blur bands, the shadow leaks past the shape, or
the effect jumps on hover, give the element an opaque surface.

## Interaction & Content

### Interactive States

Every interactive element must define all five states: default, hover,
focus-visible, active, and disabled. A hover state is not optional. Focus
must be visible, so never remove the focus indicator.

A hover state changes fill, color, or an icon's position while the element keeps
its size and place. Reserve any lift for a card, and let a value shift carry it
rather than a shadow.

Touch targets must be at least 44px × 44px. If the visual element is smaller,
expand the hit area with padding or a transparent pseudo-element.

Limit primary actions to one per screen. Require a confirmation step before
destructive actions. Labels belong outside input fields (no floating labels).

Every control on screen answers a click, confirmed by clicking it. Where
something is a static prop, give it the form of a label or a figure so nobody
aims at it.

A control that starts a request keeps its label and adds a spinner, so its width
holds and the reader can see which action is running.

### Content States

Every data-displaying component must account for: loading, empty (zero
results), error, and populated states. Loading must show a visible indicator
rather than a blank screen. A skeleton mirrors the dimensions of the content it
stands in for, so nothing shifts when the data lands. Error messages must
identify what went wrong and what the user can do.

Text and controls reach their visible state without JavaScript and without a
scroll event. Animate what is already on screen, so a reveal that never fires
costs a transition instead of the content.

### Dynamic Content

Design for variable-length content. User names, titles, descriptions, and
translations will overflow, truncate, or wrap. Test every text container with:
- Single-character input
- Maximum-length input (or a long unbroken string)
- Multi-line overflow

Containers that accept user-generated text need explicit word-break handling. A
flex child needs `min-w-0` before `truncate` or `line-clamp-*` takes effect,
because its default `min-width: auto` refuses to shrink.

## CSS Architecture

### Sizing

Prefer `max-width` and `min-width` over fixed `width`. Prefer `min-height`
over fixed `height`. Components should flex with content rather than fight it.

### Overflow

`overflow: hidden` clips everything: shadows, positioned children, focus
outlines. Use it only when clipping is the explicit intent, never as a layout
shortcut.

Where you add a clip, a notch, or a fixed height, pad the content clear of the
cut by more than the cut removes, then zoom into that edge and read it. Content
that continues under an overlapping layer stays on the layer that remains
visible.

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

A decoration earns its place by encoding information. Each form below arrives by
reflex when nothing was decided, so the bullet names the move that replaces it.

- **Place a mark bare.** A tile, chip, or circle behind an icon or a logo
  carries nothing, so size and color the mark itself.
- **Rank with type, weight, and spacing.** A hairline beside a label, a dot
  under the active nav item, and a colored bar down a card's edge each stand in
  for structure they do not hold.
- **Contain a status only where it needs the container.** The rest of the
  metadata sits in the type hierarchy rather than in a pill of its own.
- **Vary how a section begins.** A number, an image, or a full sentence each
  open one. A small label above a large heading arrives on its own, and an
  eyebrow badge above an H1 is the same move.
- **Separate two actions by weight or placement.** A filled button paired with
  an outlined one is the default action row, and it carries no decision about
  which of the two matters.
- **Draw the stock parts for this product.** The theme switch, the step
  sequence, the feature row, and the avatar each have one default form that
  carries no decision, and a sun-and-moon toggle is the clearest of them.
- **Let a background be one considered surface.** A sheet of faint grid lines
  reads as graph paper at any opacity, and a blurred blob of accent color
  bleeding from a corner is the same reflex in color.

## Composition

Passing every rule above leaves a screen that breaks nothing. What makes it a
design is a decision this screen carries that another product could not take
unchanged. Decide that first, then build the sections from it.

- Hold one palette, one type voice, and one geometry across the screen. Parts
  that are each correct and belong to nothing read as incoherent before any
  single part reads as wrong.
- Choose the surface tone for this product. A neutral that reads as tasteful is
  still the tone that arrives on its own, and which neutral reads that way turns
  over every year or two.
- Compose the screen as a whole. Presets compound, so a run of blocks that each
  pass on their own still reads as one template with the content swapped.
- Build on the primitives in `src/components/ui/` and restyle what you take.
  Taking a prebuilt block's behavior costs nothing, and taking its styling
  costs the identity.

## Iteration Guide

1. To change token values, edit `src/styles.css`. Never write token values
   in this file.
2. When adding a new semantic color, add both light and dark values together.
3. This file describes **why** and **when**. `src/styles.css` defines
   **what** (values).

## Sources

Distilled from [pols.dev/slop.md](https://pols.dev/slop.md) and
[vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines).
Their keyboard, forms, hydration, and performance rules sit outside this file's
subject.
