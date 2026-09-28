---
description: Design system, covering color roles, typography, spacing, shapes, elevation, decoration, and composition
globs: src/**/*.css,src/**/*.tsx
alwaysApply: false
paths: src/**/*.css, src/**/*.tsx
---

# Design System

## Tokens and scope

Token values are defined in `src/styles.css`: shadcn/ui's neutral base, kept
achromatic for every surface and text role, with a hue only on `destructive`
and the chart series, and a radius scale derived from `--radius`.
That base is a starting point rather than an identity, so a project that wants a
palette, a typeface, or a corner treatment of its own replaces the values there
and leaves the rules below alone.

What an animation here may do is in the `motion-craft` skill, under Repository
defaults.

## Colors

### Semantic Roles

- **primary**: Main actions. Never as a background fill.
- **secondary**: De-emphasized actions.
- **muted / muted-foreground**: Helper text, placeholders, disabled states.
- **accent**: See Accent Color below.
- **destructive**: Deletion and error actions only. Not for general warnings.
- **border / input**: Structural separation. Subtle, never dominant.

Use semantic token names in components, never a raw color value.

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

Give a large surface one tone, and put headline emphasis in weight, scale, or a
value step.

### Dark Mode

Dark mode is a paired color scale rather than a separate system. When adding
a new token, define both light and dark values together, and declare
`color-scheme` in each mode beside them. Token switching carries the whole
scheme, so no component branches on the mode. Text on a dark background takes
the off-white `--foreground` defined in `src/styles.css`.

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
neutral, so it belongs under a display face rather than carrying one. Beyond
that pair, take no third typeface.

### Typographic Rules

- Japanese body text takes a wider line-height than Western text.
- Body letter-spacing is slightly open, headings tighter, labels and captions
  wider.
- Build the hierarchy from weight, size, and leading together rather than from
  size alone. Where two text elements look the same weight and size, one of them
  is wrong.
- Set monospace where the content is data: a timestamp, a code, a price, a
  table. Captions, labels, and running copy take the body family.
- Give the small text roles different treatments. Where the eyebrow, the button
  label, the caption, and the footer line all wear the same tracked-out caps,
  the screen reads as a template instead of a voice.

## Layout

Spacing follows Tailwind's default scale: the smallest tier inside a component,
the middle tier between components, the largest for page structure.

Space siblings with the parent's `gap` (flex/grid), never with a margin on each
child, which collapses, doubles up, and has to change when a sibling is removed.

Put parallel items on one grid, so the title, the body, and the control share a
line across every column. Give the columns equal height, anchor the control to
the bottom of each, and hold the slot of a value that is missing in one column.
Copy length then stops deciding where a neighbor's content lands.

## Shapes

Pick the radius tier that matches the element's size, and do not introduce
values outside the set derived from `--radius`.

## Elevation

Hierarchy and separation come from background color difference, border,
backdrop dim, spacing, and typography, never from shadow.

Shadow is limited to two cases:
- **Drag state**: the element being dragged gets shadow to communicate
  "lifted off the surface." Remove on drop.
- **Sticky header on scroll**: shadow appears dynamically when content
  scrolls beneath a sticky element. No shadow at rest.

In those two cases, cast the shadow from one direction with a small offset and
a small blur, tinted to the surface or to the element's own color. A bloom
spread evenly on all sides, or a second box placed behind the element to imitate
one, reads as a sticker rather than a lit object.

Where a container needs an edge, shift its surface a step from the background
and stroke it with its own color at low opacity, which keeps border, shadow,
and text on one hue.

A translucent surface needs a backdrop worth showing through and a blur that
blends at every edge. Where the blur bands, the shadow leaks past the shape, or
the effect jumps on hover, give the element an opaque surface. Never stack one
translucent surface on another.

## Interaction & Content

A hover state changes fill, color, or an icon's position while the element keeps
its size and place. Reserve any lift for a card, and carry it with a value shift.
Gate a hover animation behind `@media (hover: hover) and (pointer: fine)`, which
leaves it out on a device whose pointer cannot hover.

Limit primary actions to one per screen. Require a confirmation step before
destructive actions. Labels belong outside input fields (no floating labels).

A control that starts a request keeps its label and adds a spinner, so its width
holds and the reader can see which action is running.

Text and controls reach their visible state without JavaScript and without a
scroll event. Animate what is already on screen, so a reveal that never fires
costs a transition instead of the content.

## Decoration

A decoration earns its place by encoding information. Each form below arrives by
reflex when nothing was decided.

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
  reads as graph paper at any opacity, a blurred blob of accent color bleeding
  from a corner is the same reflex in color, and a gradient blended across the
  background or poured into type reads as unchosen whichever pair of hues it
  takes, with blue into purple arriving by default.

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
- Build on the primitives in `src/shared/ui/` and restyle what you take.
  Taking a prebuilt block's behavior costs nothing, and taking its styling
  costs the identity.
- Restyle a primitive by changing its variants in `src/shared/ui/`, not by
  passing appearance classes at the call site. A call site passes the classes
  that place the element, such as its width or its position in a grid or flex
  parent. Color, typography, spacing, shape, effects, and motion belong to the
  primitive, so a screen that needs a new treatment gets a new variant that
  every other screen can then take.
