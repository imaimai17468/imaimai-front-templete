---
name: anti-slop-design
description: The pols.dev anti-slop design law — a comprehensive catalog of generic "AI slop" UI patterns to avoid (glowy pill buttons, gradient heroes, kitchen-sink cards, default font pairings, botched glass/shadows/glows, slop layouts) and what premium craft looks like instead. Use EVERY time you design, build, restyle, or review any user interface, landing page, or visual component — read it before starting, and re-check the output against it before calling the work done.
---

# The anti-slop design law — read this every time

**Follow this deeply and religiously.** Use it every single time you design or
build any interface. Read it before you start, keep it in mind while you work,
and read it again before you ship, checking your output against every point.
Re-read it often; it is easy to forget and easy to violate. When any instinct of
yours conflicts with what is written here, this wins.

**Confirm it, then prove it.** Before you begin, tell the user in plain words that
you have read this entire file and understood every point — and promise that at
the very end you will do a whole, detailed re-check of every single point here,
find and fix any UI error or bug, and hand over your very best work. Then keep
that promise: actually walk this file point by point and fix what falls short
before you call anything done.

**The user's word overrides these defaults.** Everything below is the DEFAULT —
follow every point religiously unless the user has given you a specific,
unambiguous instruction that conflicts with it. If they tell you to do a
particular thing (a colour, a layout, an effect this file warns against), do
exactly that, because they asked; their direction wins, 100%. Absent that
direction, this file is law.

---



# What is AI slop?

Generic, low-effort, look-the-same AI output. Avoid it by making real choices.

## Lucide React package

`lucide-react` is an icon pack: a library of clean, consistent SVG line icons
exposed as React components, open source and bundled (no network calls).
Browse them at https://lucide.dev. Common icons: Sparkles, Coffee, Dumbbell,
Plane, MapPin. It has no brand logos (Instagram, GitHub, etc.). The uniform
thin-stroke look is a giveaway when it shows up on every project.

## Em dashes

A classic tell of AI writing. Use a regular hyphen, a colon, or just split the
sentence instead.

## Pill / eyebrow badge

A small capsule above a hero headline: a tiny icon plus short text inside a
rounded "pill". Also called an eyebrow or chip. Overused as default hero
decoration.

## Fonts: Fraunces and Work Sans

An overused pairing in AI-made sites: Fraunces (serif display) with Work Sans
(body). Reach for less default typefaces.

## Glowy pill buttons

Fully rounded "pill" buttons with a gradient fill and a soft glow or blurred
drop shadow beneath them. The blurred shadow under buttons and cards is a
common slop signature.

## Oversized icon in a colored tile

A single big icon centered inside a filled rounded square or circle, used as a
hero visual or feature bullet. The "icon in a soft-colored box" look is
everywhere.

## Floating cards

Small cards layered over a hero that gently bob or float with a looping
animation (often plus a parallax or hover lift). Decorative motion with no
purpose.

## Cut-off glow

A soft glow or blurred light behind a button or element that gets clipped by a
section edge or `overflow: hidden`, so the glow visibly ends in a hard line.
The accidental hard edge on a "premium" glow is a dead giveaway.

## The kitchen-sink card

One rounded card that stacks every tell at once: an icon in a colored tile, a
category pill, a row of small rounded tag pills, a hairline divider, a big
price, and a glowy "Add" button with a bottom shadow. No single piece is wrong,
but piling them all into one card is the clearest slop signature of all.

## Fake macOS / app window mockup

A faux product screenshot drawn in CSS to look like a desktop window: rounded
corners at a "Mac" radius, a dark boxy panel, the three red/yellow/green
traffic-light dots, and a mock UI inside (kanban columns, avatars, status
pills). The whole "look, a real app window" prop is a standard hero filler.

## Font: Space Grotesk

The geometric grotesque used for big bold headlines (usually with Inter for
body). Instantly recognizable and overused as the default "techy SaaS" voice.

## Purple, and blue-to-purple gradients

The default AI palette. Purple alone is overused; blue and purple together is
worse; a soft blue-to-purple gradient is the single most recognizable slop
color move. Glowy gradients of this kind in general (any direction, any two
adjacent hues) read as machine-made. Pick a real, considered palette instead.

## Gradient pill with icon and text

The worst stack: a rounded box or pill filled with a blue-purple gradient,
holding a small icon plus a line of (often uppercase) text. Gradient plus pill
plus icon plus label in one tiny element is a complete slop fest.

## The default CTA button pair

Two buttons side by side at the same medium corner radius: a gradient-filled
primary with dark text, a small arrow icon, and a glow behind it, next to an
outlined "ghost" secondary ("See how it works"). The exact radius, the
dark-text-on-bright-fill, the trailing arrow, and the glow recur on countless
sites even when the colors change. Style buttons with intent, not this preset.

## The three-tier pricing block

Three cards in a row (Free / Pro / Enterprise) with a tiny pill above the
heading, a big price with a "/ mo" suffix, a checkmark feature list, and the
slop CTA button at the bottom. The middle card is always the "highlighted" one:
a glowing gradient border and a "MOST POPULAR" pill floating on its top edge.
The whole layout, including that glow-plus-pill highlight trick, is a preset.

## The testimonial / quote card

A wide rounded card with a big quote-mark icon centered up top, a centered
quote, then an avatar with a name and a job title ("VP Engineering, Northwind
Labs") underneath. The fake-but-impressive metric in the quote ("velocity
jumped 32%") is part of the same prefab.

Sibling tell: wrapping a line of example or quoted text in big rounded
quotation marks (curly "smart quotes" used as decoration, or a giant quote-mark
glyph) to make it feel human or testimonial-like. The decorative quote mark is a
prefab gesture, not a design. If a line needs emphasis, give it real type and
space, not a pair of ornamental quotes.

## Gradient-circle initials avatar

Two-letter initials (e.g. "SD") on a gradient-filled circle, used as a
stand-in for a real photo in testimonials, avatars, and team rows. Slop on its
own, and double so when the gradient is blue-to-purple.

## The pre-footer CTA banner

Right before the footer: a wide rounded box flooded with a blue-purple
gradient, holding a centered headline, a one-line byline ("Free to start, no
credit card required"), and one or two buttons (a dark "Get started free" plus
a light "Compare plans"). The full-width gradient slab with a final call to
action is a fixed template.

## The logo lockup (gradient icon tile + wordmark)

A brand mark made of an icon sitting inside a small gradient rounded square (an
app-icon "squircle") with the company name set beside it in a generic
geometric font. The gradient tile plus same-old wordmark combo is an instant
made-by-AI logo.

## Font: Cormorant Garamond

The default "elegant / luxury / editorial" serif: thin, high-contrast, and
almost always shown with one word set in italic for "taste". It gets reused for
completely different brands (a photographer, a fine-dining restaurant, a real
estate firm) and just swaps the body sans next to it (Jost, Mulish, Inter…).
The serif itself is the tell, whatever it is paired with.

## The split hero

The same two-column hero skeleton reused for every "premium" brand: a text
column on one side (letterspaced uppercase kicker, big serif headline that
emphasizes a single word, a quiet subline, two buttons side by side, often a
stat row under a hairline) and a framed visual card on the other (an image or
crude illustration with a caption and a floating tag pinned to it). It shows up
here on the photographer, the restaurant, and the real-estate sites with only
the colors changed. The skeleton is the tell, not any one piece.

## Grid / graph-paper background

Faint thin grid lines (often fading out with a radial mask) layered behind a
hero or section to look "technical". A default backdrop reached for whenever a
plain background feels too empty.

## Crude CSS/SVG "illustrations"

Hand-faked decorative graphics standing in for real imagery: bar charts drawn
from rounded divs, abstract floating circles/spheres, a "plate" of gradient
balls, dashed orbit rings, mock stat cards. They look low-effort because they
are generated placeholders, not real illustration, photography, or product UI.

## The accent-bar card

A plain dark box with a single bright accent line running down one edge (left,
right, top, or bottom), usually holding an icon, a big number, and a caption.
The lone colored bar stuck on a card to "add interest" is a very common move.

## Background glow

A soft radial blob of the accent color bleeding out of a corner, edge, or
center of a dark section to give it "atmosphere". Used on nearly every dark
hero and CTA band. (See also cut-off glow, the version that gets clipped.)

## The fake code-snippet window

A "developer" prop: a rounded dark panel with traffic-light dots and a
`quickstart.ts` filename tab, holding a short syntax-highlighted snippet that
calls a made-up SDK. Always the same palette (purple keywords, green strings,
grey comments) in JetBrains Mono. The window plus colors plus mono font plus
toy API call is one canned unit. (Related: fake macOS / app window mockup.)

## Fonts: Sora and JetBrains Mono

Sora is the rounded geometric sans used for "AI / deep-tech" headings; JetBrains
Mono is the default for every fake code block. Both signal machine-made the
moment they show up as the obvious off-the-shelf choice.

## Floating tag pinned to an image

A small rounded pill (an icon plus a short label like "28°C & clear") stuck onto
the corner of an image or gradient box, almost always top-left. The little
"info chip" floating over a visual is reached for to make a flat box look alive.

## Font: Syne

The chunky, slightly-quirky display sans pulled out for "edgy / music / creative"
brands set in big bold uppercase. Like Space Grotesk and Sora, it is a default
that signals "an AI picked the trendy free font".

## Gradient-filled headline text

Headline words clipped to a multi-color gradient (magenta to purple to cyan, or
blue to cyan) via `background-clip: text`. Pouring a gradient into the type
itself, usually on one emphasized word or the whole hero line, is a constant.

## Fonts: Archivo, and Inter everywhere

Archivo (heavy, athletic, all-caps) is the "streetwear / sporty / e-commerce"
display default, often shown three ways at once (solid, an accent-colored line,
and an outlined/stroked line) so it reads as "three fonts" when it is really
one. And under almost every site here sits Inter as the body font: a safe,
invisible, picked-by-default sans. Inter itself is the most common slop font.

## Hairline light border on boxes

Every card, stat box, or countdown tile wrapped in a faint 1px light border
(white at low opacity on dark, or light grey on light). The thin glowing
outline on each box, often plus a soft inner highlight, is default card styling.

## Countdown timer

A row of small boxes each holding a big number with a unit label under it
(DAYS / HRS / MIN / SEC) to fake urgency for a "drop" or "sale". A stock
urgency widget dropped in whether or not anything is actually ending.

## The card hover-lift

The default card interaction: on hover the card rises, an even drop shadow
blooms on all sides, and the border lights up in the accent color (sometimes
with a glow). The same translate-up-plus-shadow-plus-glowing-border transition
is bolted onto every card grid regardless of what the cards are.

## Letterspaced serif wordmark

The "luxury" logo move: the brand name set in an all-caps serif (usually
Cormorant Garamond) with wide letter-spacing and nothing else. Tracking out a
default serif is treated as instant elegance, so it lands on every fashion,
real-estate, and fine-dining brand. (The SaaS equivalent is the logo lockup.)

## Fonts: high-contrast Didone serifs (Bodoni, Didot)

The reflexive "luxury / fashion / watch" serif. Bodoni Moda, Didot, Playfair and
their kin, with their thin-to-thick contrast, are reached for whenever something
needs to feel expensive. They do not. They read as the obvious default just like
Cormorant. A Didone is not automatically premium; chosen on autopilot it is
slop.

## Monospace as the house voice

A mono is correct for actual data: timestamps, codes, prices, a real table. It
becomes slop the moment it is the reflexive font for copyright lines, eyebrows,
captions and labels everywhere, used to signal "technical and premium". Spread
across all the non-code text it is a costume, not a decision. Use it sparingly
and only where the content is genuinely data.

## One label treatment, everywhere

A single small treatment, usually letterspaced uppercase caps (or a mono), used
all at once for the eyebrow, the button text, the figure numbers, the nav action
and the footer colophon, is slop. When every small string on the page wears the
identical tracked-out-caps costume, it reads as a template, not a voice. The tiny
colophon line in spaced caps ("EXHIBIT 20, LIGHT AND CONSIDERED") is the clearest
tell, and the same caps on the button and the eyebrow seals it. Give different
roles different treatments, or cut the labels entirely. The same costume on every
small piece of text is the giveaway, exactly the way one font carrying the whole
brand is. (Sibling of monospace as the house voice and the kicker tells.)

## Botched glass

Glass is premium only when it is flawless, and it usually is not. The slop
versions: visible blur pixelation or banding because the backdrop is a flat
low-contrast field with nothing real to refract; a drop shadow or glow that
leaks out below the element as a dark or colored smear; a resting blurred halo
that sits behind the shape and never blends with the page; and a transition
where the blur and shadow visibly "pop" in or jump when the element is pressed
or hovered. A bad blur is worse than no blur. If you cannot make glass blend
seamlessly with no banding, no leak and no pop, do not ship glass.

## The faint grid background (restated, because it keeps happening)

Even a subtle, low-opacity, full-page module grid reads as slop. A sheet of
graph paper behind everything is the tell, faint or not. The "blueprint" look
only earns its place when it is sparing and specific (a few ruler ticks, corner
crop marks, one actual technical drawing), never a full-bleed grid laid under
the whole page. When in doubt, lay no grid at all.

## Botched fill animations

A hover animation done badly is worse than none. The failure pattern: a line or
bar whose caps flip from sharp to rounded partway through the transition (the
giveaway of animating scaleY on a rounded shape), that fills only part of its
intended length, or that eases so it stutters. If you animate a fill, animate a
clip or a width/height with stable caps, fill the FULL intended track, and ease
it smoothly. Half-built motion screams slop.

## Never hide content behind an entrance animation (the invisible-content trap)

The single most damaging motion mistake: making content start at opacity 0 (or a
translated-away "hidden" state) and relying on JavaScript or a scroll/timeline to
reveal it. When the reveal does not fire, and it will not fire often enough,
because the tab is backgrounded, the timeline is unsupported, the animation
engine is throttled or paused, a hydration hiccup, a screenshot pass, the content
is simply GONE. A whole section renders as an empty void. This applies to CSS
`animation-timeline: view()`, to a JS IntersectionObserver that toggles a class,
AND to a motion/Framer `initial={{opacity:0}} animate={{opacity:1}}` that gets
stranded at its initial frame. All three have shipped blank search bars and empty
sections here.

The rule is absolute: CONTENT IS VISIBLE BY DEFAULT. Never gate the existence of
text or a control on an animation completing. If you want motion, animate things
that are already on screen: hover states, marquees, a spinning mark, floating
pins, a sliding tab indicator, a number that counts, scroll-linked parallax on an
already-visible element. An entrance reveal is only ever acceptable when the
fallback (no JS, animation never runs) still shows the content fully. If you
cannot guarantee that, do not hide it. A static but fully-readable page beats a
beautifully-animated one that renders empty.

## Content sliced by an edge — the cut-off tell (and "clear the cut")

Text or a control whose edge is shaved off by a `clip-path`, a notch, an
`overflow: hidden`, or a fixed height reads as broken, not designed. The tell is
quiet and easy to miss: the caps of a headline sliced flat, a control missing
its top few pixels, a label whose descenders vanish into a border. It is almost
never intentional — it is content that was never padded clear of a cut the
layout introduced (a decorative notch, a clipped silhouette, a too-short row).

The rule is **clear the cut**. Whenever you add a `clip-path`, a notch, an
`overflow: hidden`, or a fixed height, prove the content sits FULLY inside the
surviving (visible) region: pad it clear of the cut by more than the cut removes,
then zoom into that exact clipped edge or corner and check it pixel-for-pixel
before calling it done. Never trust that text sitting near a cut survived it — a
notch you added for shape can crop a real word and you will not notice at normal
zoom. If you slice an edge for a silhouette, budget the padding that keeps the
content whole in the same move.

## Misaligned parallel columns — the ragged comparison grid

When items sit side by side to be compared — pricing tiers, plan cards, feature
columns, before/after, any repeated set of two or more — the corresponding parts
must line up across every column on a shared horizontal grid: the title, the
price or headline, the description, the top of the feature list, and above all
the button. When one column's copy runs longer than another's, it shoves that
column's rows down and the whole grid goes ragged: buttons at different heights,
feature lists starting at different points, subtext of uneven length knocking
everything out of step. It reads as broken and unconsidered, and it is one of the
loudest slop tells in a comparison block.

Alignment does NOT depend on content length. Whether there are two boxes or
twenty, every parallel row sits on the same line across all of them. Do it
deliberately: give the cards equal height and anchor the button to the BOTTOM of
each (so a short column's button doesn't float up while a long one's sinks),
reserve equal space for variable-length copy so a long description in one column
can't push its neighbours down, and lay the columns on one grid so each role —
title, price, body, list, CTA — shares a baseline. If a value is missing in one
column, hold its slot rather than collapse it. Never let the longest string in
one cell decide where every other cell's content lands.

## Text jammed against the edge

Type set hard against the rim of the viewport or its container — a line whose
first letter kisses the left edge, a label pressed into the top, a paragraph with
no gutter on the right — reads as slop. Text needs a margin to sit in; touching
the boundary looks like it overflowed by accident, not like it was placed. Give
every text block a deliberate, generous gutter from every edge it nears, and keep
those margins consistent so nothing looks shoved. The exception is a deliberate
composition — an oversized wordmark or watermark cropped on purpose — but ordinary
copy arriving at the edge with no space is not that; it is a missing margin.

## The default all-around shadow

A soft shadow bloomed evenly on every side of an element — a card, a button, an
icon, an SVG, an animated object — added by reflex rather than intent is slop.
The wide symmetric drop shadow, the "float everything on a fluffy cloud" look, is
one of the most common machine-made signatures. Do not put a shadow on something
by default. When depth is genuinely needed make it sleek and directional: a
tight, low-offset shadow with a small blur, tinted to the surface or the
element's own colour rather than a big black bloom, cast as if from one light
source instead of radiating all around. Better still, get depth from tone and a
self-coloured edge and use no shadow at all. A shadow is a deliberate directional
decision or it is absent — a fat halo around everything is the tell.

## Content flung to the far edges (default asymmetry)

Splitting a block's pieces to opposite rims — a footer with the tagline hard
against the far left and the link columns jammed against the far right, a wide
dead gulf between them, nothing sharing an axis — reads as slop when it happens by
default rather than by design. The imbalance registers instantly: two clusters
marooned at the edges with empty space stranded in the middle. Unless the
asymmetry is a deliberate, composed choice, default to symmetry and alignment:
put the footer on a real grid, align its columns to the same margins as the
content above, and balance the weight across the width instead of shoving it
outward. This is the general rule, not just for footers — with no creative reason
to break it, symmetry and alignment read as considered; scattered-to-the-edges
reads as unplaced.

## Missing (or faked) logos and icons that would earn their place

Two failures, one coin. Leaving out social icons or the recognisable logos of
real companies and integrations, where they would genuinely add legitimacy and a
premium feel — a social row in a footer, a "works with" strip, a wall of real
customer marks — can leave the work reading thin and unfinished. But adding them
when they are not warranted, or inventing them, is worse. So judge the case: if
icons or logos are not needed, do not add them at all. If they are needed and
would lift the work, use the REAL marks — pull genuine brand SVGs the normal way
a coding agent would (an official icon set, the brand's own asset, a reputable
icon package), at one consistent size and a single quiet treatment. Never invent
a logo, never fake a customer, never drop a uniform icon-pack row in just to fill
space. Real marks used honestly and sparingly are the premium version; missing or
fake is the slop.

## Nothing is actually centered — the chronic centering miss

The single most repeated execution failure: content that is meant to sit in the
center of a box, a circle, an SVG shape, a badge, a pill or a button, and does
not. A number floating high in its circle, a glyph sitting low in its tile, a
label pushed off-axis in its pill — off by a few pixels or off badly, because the
centering was assumed instead of proven. It reads as broken, and it is
everywhere. Center what you meant to center, actually, every single time, by
default — then VERIFY it, do not eyeball it and move on. In SVG especially,
remember the traps: `text-anchor: middle` centers horizontally but you still need
`dominant-baseline: central` (or a measured `dy`) for the vertical; a glyph's
optical center is not its bounding-box center; a rotated, stroked or padded shape
moves where "center" actually is. Zoom into the shape and confirm the content
sits dead-center — mathematically AND optically — before calling it done.

## Faking a shadow with a second box

Told not to use a big shadow, do not "obey" by dropping a literal offset box, a
duplicate element, or a dark rectangle behind the thing to imitate one. That is
not following the rule, it is routing around it, and it looks worse than the
shadow would have: a hard-edged grey slab peeking out from behind the shape. If
the element genuinely needs to lift off the surface, use a real, tight, low-offset
shadow with a small blur, tinted to the surface or the element's own colour, so it
pops subtly and honestly. A small true shadow beats a faked one every time. Never
reproduce an effect with clumsy geometry to dodge a rule — do the restrained,
correct version of the effect instead.

## An icon or a logo with a box behind it

An icon set inside a filled tile, chip, circle or rounded square is slop — and
this is JUST AS TRUE FOR LOGOS. A brand mark, a social glyph or an integration
logo dropped onto a coloured or bordered box behind it reads as a component-kit
default, not a designed mark. Strip the container: place the icon or the logo on
the surface as the bare mark, sized and coloured with intent. The box behind it
adds nothing but the machine-made look. If a mark needs separation from its
background, get it from the mark's own weight, colour and spacing — never from a
tile parked behind it.

## The little rule beside a label (the eyebrow tick)

A short hairline drawn next to a kicker or eyebrow label — a ~30px line, often a
gradient that fades out, sitting before "PRODUCT" or "AUTONOMOUS CODING AGENT" —
is a decorative tic, not a design. It is reached for to make a plain label feel
"designed," and it lands on countless machine-made layouts. A lone line used as
ornament beside text carries no meaning and adds no structure. Drop it; if a label
genuinely needs more presence, give it that through type, weight, colour or
spacing, not a little rule tacked on beside it. (Same family as hairline dividers
and unrounded rules used to fake structure.)

## The oversized footer wordmark done as slop

The giant brand word at the bottom of a page is a strong move ONLY when it is
actually composed. Pasting big text down there to tick the "signature wordmark"
box, with none of the craft, is slop, and it fails in a stack of specific,
checkable ways — often all at once in the worst version:
- It is not centered, and not aligned to anything: the word sits crooked in its
  space.
- It is clipped: the tops of the caps (the peak of a `D`, an `E`, an ascender)
  are sliced off by the container or the page edge. Clear the cut — give it real
  top and bottom breathing room so no glyph is shaved.
- It carries a gradient inside the type that fights the gradient or colour behind
  it, so two gradients clash instead of one surface reading cleanly.
- The typeface is a default and the treatment is nothing: flat text pasted on, no
  letter-spacing, no case decision, no effect, no idea.
The reason this move works when it works is the creative twist: generous letter
spacing, a deliberate case (often full caps), room above and below, a colour or
texture that belongs to the brand, the word bleeding intentionally off one edge
while staying whole and centered on the others. Do THAT, or do not put the big
wordmark there at all. A signature is a composition, never text dropped in to
satisfy a rule.

## Colliding colours, and hard colour seams between sections

Colour is one of the fastest routes to slop, and it fails in two directions.
First, colours that collide: two saturated or unrelated hues fighting in one
view, an accent that belongs to no system, or a muddy wash (a dim brown, a
grey-beige, an uneven lighter-on-top-and-bottom tint) laid under a component that
was fine on its own — a good element dropped into a bad colour envelope looks
ugly, and the element is not the problem, the colour context is. Second, hard
seams BETWEEN sections: one screen carries a soft gradient or glow and the next
screen cuts it off dead at the boundary, so the eye hits a wall where the colour
should have carried through. The page should move as one continuous surface — the
colour of one section resolving into the next, not stopping at a hard line. Hold
a single disciplined palette across the whole page, let adjacent sections share
or hand off their tone, and lean on real colour theory (complementary and
analogous relationships, not a pile of swatches). Reserve a deliberate hard
colour break only for the rare place it is meant — a footer stepping onto its own
darker floor, say. Seamless colour transitions read as considered, but do not put
one on every edge either; too much of a good thing tires the eye. Aim for
complementation and continuity, not a gradient everywhere.

## Botched shadow — the hard-edged box behind it

A shadow that reads as a solid, hard-edged rounded rectangle sitting behind the
element — a visible box silhouette rather than a soft fall-off — is botched. It
happens when the blur is too tight for the spread, or a second layer is doing the
work, so instead of light fading into the surface you see the outline of a
rounded box parked behind the shape, and the shadow effect breaks. A real shadow
is seamless: it blends into the surface with no detectable edge. If you can trace
the shadow's border, it is not a shadow, it is a box. Soften the fall-off,
tighten the offset, and carry the blur all the way out so nothing reads as a
duplicate panel behind the element. (A genuine engine or capture constraint that
bands a shadow is forgivable; shipping a boxy seam by default is not.)

## Text you cannot read — colour with no contrast

The most basic failure, and still common: text set so close in value to what is
behind it that you cannot read it. Dark ink on a dark surface, a mid-grey label
on a mid-grey panel, a dim tint of the accent sitting on the accent itself — the
words are there but the eye has to fight for them. On a filled button this is
unforgivable: if the label does not stand clear of the fill, the button has
failed at the one thing it exists to do. Every piece of text must clear its
background by a real value gap; when in doubt push the contrast further, not less.
Colour is not just palette, it has to be legible.

## The bloom that is just the element's shape, blurred

A specific botched shadow worth naming on its own: a glow or drop-shadow that is
really just a blurred copy of the element's own outline, offset behind it. Because
it is inset from the edges, the edges themselves show no shadow while the colour
pools out to the sides and the bottom, and you can watch the blurred silhouette
round off — a second rounded box hovering behind the first. It reads as a sticker
with a halo, not a lit object, and it does not transition seamlessly into the
surface. A real shadow is cast: directional, tight, and it never traces the
element's shape. If you can see the thing repeated in its own shadow (or its own
glow, on a logo or an animated mark), delete the bloom and cast one small,
low-offset shadow from a single direction instead. Less bloom, always.

## The dot under the active nav item

Marking the current page with a small dot tacked under the link is a slop reflex.
A lone dot beneath a menu item carries no meaning — it is decoration standing in
for a real active state, the same instinct as the growing underline in a
different costume. If the active item must read as active, do it with the type: a
weight or colour shift on the current link, not a mark bolted on beneath it. (A
genuine sliding tab-indicator can be a real pattern; a stray dot for "you are
here" is not.)

## Content clipped where two sections overlap

When one section sits over another — a panel that rises over a sticky screen, a
sheet that slides up, anything on a higher layer covering what is below — content
that is meant to continue past the seam must carry through, not get sliced at the
boundary. The failure: the upper layer clips everything below its edge, so a line
of text or a control that should keep going is chopped where the section ends and
you see half of it hanging at the cut. If content continues across the overlap,
keep it on the layer that stays visible and clear it past the seam; never let a
section edge (or its `overflow: hidden`) guillotine what runs beneath it. (Sibling
of "clear the cut": a boundary you introduce must never crop live content.)

## Cramped display type — no air to breathe

A display number or word set too tight — letters and separators jammed together,
tracking pulled negative until the glyphs nearly touch — reads as cramped and ugly
even when the typeface is good. A stat like "0·fail" fails not because of the font
but because the pieces are crushed against each other with no breathing room and
the little separator dot is buried between them. Big type needs air: loosen the
tracking, give the separator space, let the number and its unit sit apart. The
larger the type, the more the spacing decides whether it looks composed or
squeezed — a beautiful face crushed tight still looks bad.

## Grain sitting on top of the content

Premium grain textures a surface — the background, a gradient, a painting — and it
belongs BEHIND the content, not over it. When the noise layer sits on top of text,
icons, an SVG, a terminal panel, it fights legibility: the words and marks go
muddier and harder to read, and the effect that was meant to feel tactile just
hurts. Keep grain on the substrate and let text and controls stay crisp above it.
There is a real creative exception — grain deliberately masked onto ONE display
word or one heading can look intentional and lovely — but that is a chosen move on
a single element, never a blanket sheet laid over everything including the parts
people actually need to read.

## The cool blue-charcoal (dark slop's default palette)

Blue-purple is slop in gradients, and it is slop in the dark too. The default
"serious dark product" base — a cool blue-charcoal or slate-indigo ink (around
`#0c0e15`), lifted to a slightly bluer panel, with a lilac or periwinkle accent
used "sparingly" — is the night-mode twin of the blue-to-purple gradient. It
signals that nobody chose the palette; the theme just defaulted to cool-blue dark.
A dark UI does not have to be blue. Warm it, neutralise it, or push it to a
genuinely chosen hue — a green-black, a warm charcoal, an oxblood-black — anything
that belongs to this one brand instead of the stock indigo-slate every dark SaaS
ships.

## The pastel candy gradient background

Blue-purple is the famous one, but the warm pastels are the same slop in a
sweeter palette: a soft multi-stop background wash of butter-yellow into peach
into strawberry-milk pink (the `#ffe6a8` to `#ffc0da` family), or mint-to-lavender,
sherbet-to-cream. A page-filling candy gradient signals "AI startup landing" as
loudly as the indigo one does. A background can carry colour, but let it be a
chosen, specific atmosphere - a crafted image, a single considered tone, a
gradient that belongs to this ONE brand - not the default sunset-sorbet wash that
could sit behind any product.

## Drifting soft-blend gradient blobs (the candy aurora)

A handful of big, soft, blurred radial-gradient blobs floating behind the content
- one yellow, one purple, one green - each at roughly `opacity: 0.5` with
`mix-blend-mode: multiply` and a light `blur`, so they melt into a pastel aurora:
this is one of the most recognizable machine-made backgrounds there is. The
multiply-and-blur is exactly what makes it read as the generic "soft gradient
orbs" template - and muting the hexes does not rescue it, it just makes a tidier
version of the same slop. If the background needs life, author it: directional
light with real falloff, a crafted illustration or line field, a grained gradient
with one deliberate colour - not three tinted blobs drifting behind everything.

## Radial glow halo behind an object

A soft concentric bloom placed directly behind a hero object (the "two faint
circles of glow" look) reads as slop even when the color is warm. Warmth does
not rescue a centered radial halo. Light an object with a real directional
source, a rake or a single beam with falloff, never a symmetric glow ring
sitting behind it.

## A hero that does not own the first screen

The first viewport is a composition, not an accident. If the hero is shorter
than the screen so the top of the next section peeks in below it, unaligned and
asymmetric, the whole page reads as sloppy before the user scrolls. Compose the
hero to own the fold: size it to the viewport (or deliberately control exactly
what is visible at the bottom edge), and make that first frame balanced. Never
let a stray half-section bleed into the hero.

## The cream / beige "editorial" background

Warm cream, bone and beige are now the default "tasteful premium" background and
are overused to the point of slop. Reaching for cream is the new reaching for
a blue-purple gradient: a safe move that signals nobody chose the palette. Pick
a real, specific background color for the brand. Dark, cool, saturated or odd
can all be more premium than another sheet of oat milk.

## The slop gray (the default UI-kit neutral)

The cool light gray that ships as the "neutral surface" in every UI kit, the
gray-100 / gray-200 family (around #f3f4f6, #eceef2, #e7ecf3), is slop the moment
it becomes the footer band, the section divider, the card fill or the page base.
It is the light-mode twin of reaching for cream: a safe, unchosen neutral that
signals nobody picked the palette. A footer or surface sitting in this gray reads
like a wireframe left at its default. Pick a real, brand-specific surface tone, a
tinted off-white, a deepened or warmed neutral, a color that belongs to this one
brand. The gray is never actually neutral; it is a non-decision wearing the
costume of restraint.

## Default Google fonts, the whole rotation

This has been tested to exhaustion: nearly every free Google font reads as slop
the moment it CARRIES the brand, across every category. THE FULL REJECTED LIST
so far (sans/grotesque): Inter, Space Grotesk, Sora, Syne, Archivo, Onest,
Darker Grotesque, Geologica, Hanken Grotesk, Spline Sans, Schibsted Grotesk,
Gabarito, Figtree. The "friendly rounded" Google sans (Gabarito, Figtree, Quicksand
and kin) is not a safe-because-cheerful exception; it reads as the generic startup
font just like the rest. Nor are the fat, gooey, bubbly ROUNDED DISPLAY novelty
faces - Bagel Fat One, Baloo, Fredoka, Chewy, Lobster and their kin - loaded from
Google to carry every heading, the wordmark, prices and buttons while the body
sits in default system-ui. The candy face does not read as playful brand craft;
it reads as the free novelty display font, and pairing it with a system-ui body
is the tell doubled.
(Serif): Fraunces, Cormorant, Bodoni and the Didones, Petrona, Hedvig Letters
Serif, Brygada 1918, Young Serif. Young Serif especially: a free Google display
serif (single weight) reached for as the "warm, chunky, antique patent / spec-
sheet" voice, carrying headlines AND big stat numbers - it reads as the free
old-style-serif default just like the rest, whatever character it seems to have. (Mono): JetBrains Mono, IBM Plex Mono, Spline Sans Mono,
Fragment Mono, and mono-as-house-voice. Note Fragment Mono especially: it is a
"reference" mono lifted from a premium site, and it STILL reads as slop the
moment it carries running labels and status text. Pulling a font off a good site
is not the same as choosing one for this brief.
Heavier, bolder, or more "designy" is not more distinctive; it is still the
recognizable free default. Two hard rules now:
1. Stop cycling Google fonts hunting for the safe one. The face that carries the
   identity has to be genuinely distinctive, and at this bar that usually means
   a licensed or self-hosted typeface, used with conviction. A plain neutral
   font may sit quietly in body text, but the signature line cannot rest on
   anything off the Google shelf.
2. Do not reuse a font (or the same serif-headline-plus-clean-sans pairing) you
   already used on another site here. A recognizable house pairing repeated
   across briefs is itself a tell. Each site gets its own type decision.

## The hover boop (a button that jumps)

A button that lifts (translateY) or scales up on hover is slop. The little
"boop" upward is a default template reflex, not a considered interaction, and a
button should not move on hover at all. Change its state cleanly instead: a fill
or color shift, the icon sliding sideways. Reserve any
lift for cards at most, and even there keep it tonal and grounded, never bouncy.

## The inner-glow box (a badge that lights up from inside)

A bordered pill, chip, badge or box with a glowing tinted fill inside it, or a
pulsing glow behind a status dot, is slop, the same family as every other glow
tell. Boxes should not light up from within. If a badge needs presence, give it
an honest solid surface and a real border, not an internal bloom. The pulsing
"live" dot with an expanding glow ring is the same reflex; drop it.

## The off-center strike or cut line

A line drawn through text (a strike-through, a cross-out, a redaction bar) that
does not sit optically centered on the glyphs is slop, and badly off it is
extra-loud slop. If you draw a line through a word it must run through the true
vertical center of the letterforms, not float low near the baseline or high near
the caps. Measure it against the real x-height, not a guessed percentage. An
uncentered line through type reads as broken, not deliberate.

## The default hero stack

Eyebrow or kicker on top, then a headline, then a subline, then a primary button
with a secondary text link beside it ("Get started" plus "See the proof"). This
exact vertical stack is on a million homepages. It is a slop LAYOUT even when the
type and color are fine, because the composition is the one everyone ships.
Owning the fold is not enough; the arrangement itself has to be a real
composition. Break the stack: change the axis, split or offset the pieces, let
the signature artifact carry the space, drop the secondary link, or put the
elements somewhere other than centered-and-stacked-down-the-middle.

## The fixed background that just follows the scroll

A background layer pinned with position: fixed that simply trails behind the
whole page as you scroll, sitting under everything including the nav with no
separation, reads as cheap and lazy. A flat grid of ASCII characters that only
twinkles in place is not the creative animated field it was meant to be; it is a
static texture wearing a costume. If a background is the signature it has to
actually do something (move, react, transform, relate to the content), and it
should not be one fixed sheet dragged behind every section, least of all behind
the nav. Either make it genuinely creative and integrated, or do not lean on it
as the signature at all.

## Hard image seams

A full-bleed image that butts against a flat background section with a hard
horizontal edge, a visible line where the photo stops and the color starts,
reads as a band pasted onto the page. Feather the edge so the photograph
dissolves into the sections above and below with no seam.

WHAT ACTUALLY WORKS (verified at both edges, after two failed tries):
mask the IMAGE'S OWN pixels, and get all four of these right together, or it
still bands.
1. Mask, not overlay. A color-gradient overlay leaves the image at full opacity
   underneath and the eye catches the join. Fade the image itself:
   mask-image: linear-gradient(to bottom, transparent 0%, ... #000 31%,
   #000 65%, ... transparent 100%).
2. Long AND finely eased. The fade must run over a big distance (here ~30% of
   the section at each end) with MANY stops (10+), so it eases in. A short fade,
   or one with only two or three stops, still reads as a faint line.
3. Tall section. Long top and bottom fades will eat the whole image on a short
   section. Make the image section tall (here 116vh) so a full-opacity middle
   strip survives between the two feathers.
4. Continuous page color. The sections above and below must be the same
   background color, so the masked-away edges reveal one unbroken surface with
   nothing to seam against.
The failure that made the BOTTOM worse: a text-contrast scrim that ended at the
section boundary at partial opacity. That scrim becomes its own hard band at the
edge. Fix: any darkening for text must sit only behind the text and fade back to
transparent BEFORE both edges; carry the rest of the legibility on a strong
text-shadow.

## Saturated accent color

A bright, mid-saturation brand hue splashed onto type, dots and buttons is slop,
whatever the hue. The accent word in a two-tone headline, the little filled dot
before an eyebrow, the solid fill of the primary button, the one colored label:
when they are all the same vivid saturated swatch, the page reads as a template.
Saturation and contrast are the tell, not the color itself. The premium form of
an accent is TONAL: a value shifted much lighter or much darker than its
surroundings, usually desaturated, so it reads as a considered tint rather than a
sprayed-on highlight. The dim grey of a code comment, or the faint text on a
running process, is the right kind of accent; a poster-bright fill is not. If
every accent on the page is one loud saturated color, recolor them into quiet
tonal steps off the background or the ink. This also bounds the two-tone headline
move: emphasis works as a tonal shift, never as a saturated color pop.

## Underline-fill hover animations

A link or button whose underline grows, wipes or travels in on hover is slop. It
is the reflexive "look, it is interactive" flourish, and it shows up everywhere:
the nav item that sprouts an underline, the ghost button whose underline fills
left to right. As a default, do not animate underlines — reflexive fills are the
tell. If a hover must read, change the state cleanly and quietly (a tonal color
shift, an icon that slides). The one exception is a deliberately-tuned bespoke
line-fill with an invented cap, easing, and character that could not be pasted
into any other site — that is the crafted version described under Authored
micro-interactions, not the reflexive default banned here.

## The sun-and-moon theme toggle, and redrawn line icons

A rounded pill that slides a knob between a sun and a moon is the stock theme
switch, and it reads as slop the instant it appears. The same goes for a set of
thin single-stroke line icons drawn to look "custom": a document with a
checkmark, a few linked circles for "agent", a shield with a tick. Hand-drawing
the usual icon-pack shapes does not make them yours; they still read as the
generic outline set. Bespoke iconography needs a real point of view in the marks
(an unusual construction, a consistent invented detail, a weight that belongs to
the brand), not the default glyphs redrawn. If an icon could sit on any other
product unchanged, it is slop. A theme switch, likewise, can be almost anything
other than the sun-moon pill.

## Unrounded hairline rules, lines used as decoration

A thin, hard, square-capped rule dropped in to separate things, or set beside a
block of text, reads as cheap. A lone vertical or horizontal hairline used as
ornament (a divider next to a paragraph, a rule under a label, a rail down a list)
is a lazy way to fake structure. If a line must exist, give it intent: round its
caps, make it part of an invented shape, or replace it with real spacing and
hierarchy. A bare unrounded line is a tell on its own.

# Slop layouts (the compositions I keep repeating)

Fonts are one axis; LAYOUT is the other, and a recolored layout is still slop.
These are the exact section compositions that have been reused across these
sites with only the palette changed. Each is now a tell on its own. In step 5 of
the workflow, explicitly ask: have I used this layout or this font before? If
yes, change it.

## The kicker-plus-serif-H2 section head

Every section that opens with a tiny uppercase accent-color kicker ("THREE
PLACES", "THE IDEA", "HOW IT WORKS") above a medium serif headline. It sits on
the top of nearly every section of nearly every site here. The kicker label is
decoration and the pattern is a template. Vary how sections begin: drop the
kicker, change the scale, let a section open with an image, a number, a full
sentence, or nothing.

## The big serif statement block

A section that is just a kicker plus one large serif sentence with a single
italic-accent word ("your own thoughts get loud again"). Used as the
"philosophy / the idea" beat on site after site. One italic-accented pull-quote
in a serif, centered or left, is a reflex, not a composition.

## The inset enquire island with a form

The rounded panel floated with margin on all sides, centered, holding a kicker,
a big serif headline with an italic-accent word, a one-line lead, and a form.
The "Tell us when you need to disappear / we run a handful of retreats" island
is the same prefab as every other closing CTA here, recolored. The inset island
was a premium move once; used as the default closing section every single time,
it is slop.

## The email-pill plus button form

A long pill-shaped email input beside a pill button ("you@email.com" plus
"Request an opening"). This identical signup row appears on Olea, Kiln and Alta
with different colors. It is the single most repeated component here. A
newsletter capture does not have to be a pill field next to a pill button.

## The image card with overlay caption

A portrait image tile with a bottom gradient scrim carrying a small uppercase
meta label, a serif name, a place line, then a description and a "link arrow"
underneath. The travel/product card preset. The image inside is real and good;
the card wrapper around it is the same template every time.

## A flat fill under everything after the hero

The worst one here, and the one just shipped. A stunning full-bleed image hero,
and then every section below it drops to ONE flat dark (or flat cream)
background with boxes on it. The atmosphere stops at the fold. A page is not
premium because its hero is. The WHOLE page needs atmosphere: more imagery, a
textured or toned surface, a real environment, depth that carries the signature
down the scroll, not a blank field for everything after the first screen.

## Recycling your own house style

The deepest version. A kicker-H2 head, a serif statement, image cards, an inset
island with a pill form, a serif-plus-clean-sans pairing, and an oversized
footer wordmark, applied to every brief with a new palette. That recurring kit
IS a template, even though each piece was once "premium". If the last site and
this one share the same five section shapes, you built a theme and reskinned it,
you did not design. Compose each site's sections differently, from the brief.

## The hero stack with a panel on the right

The single most over-shipped hero: a small eyebrow or status line, then a huge
headline, then a paragraph of subtext, then two buttons, with a product panel,
image or card floating on the right. Every piece can be clean and the whole is
still slop, because the arrangement is the one on a thousand homepages. It does
not matter what sits in the right-hand panel. The left-column-text plus
right-column-object skeleton, holding the eyebrow then headline then subtext then
buttons stack, IS the slop. Break it: change the axis, drop pieces, let one
element own the space, put the content somewhere other than a tidy left stack.

## The multi-line headline (and the dangling accent word)

A headline that breaks onto three or more stacked lines reads as slop, and four
lines is worse — a tall staircase of short rows with no rhythm and no composition,
just type wrapping wherever the box happens to end. Hold a display line to one or
two lines, or compose it as a real arrangement; never a tall stack of three or
four. The two-tone trick makes this worse, not better: when the accent word — the
one coloured or italic word — lands alone at the end of a tall wrapped stack, it
reads as a random splash of colour, disconnected from the phrase it belongs to.
Why is one word at the bottom suddenly orange? If you emphasise a word, keep the
emphasis coherent with the line: one deliberate accent inside a controlled one- or
two-line headline, not a stray coloured word stranded at the foot of a four-line
pile.

## The filled-button-next-to-outlined-button pair

One solid filled button beside one outlined "ghost" button is a slop layout, full
stop. The filled-primary plus outline-secondary couplet is a preset, regardless
of color, radius or label, and the underline or arrow flourishes on them only
make it louder. Do not pair a filled and an outlined button as the default action
row. Use one clear action, or differentiate two actions in a way that is not the
stock fill-versus-outline duo.

## The small-label-over-big-heading section head

Opening a section with a tiny label and a large heading under it (a mono or
uppercase kicker like "WHAT IT ACTUALLY DOES" above a big "Not a chatbot ...") is
a slop layout in ANY typeface, not just a serif. Small-text-on-top,
big-text-below is the template for starting a section. Vary how sections begin:
drop the label, change the scale, open with an image, a number, or a full
sentence. (This is the kicker-plus-H2 tell, generalized past serifs.)

## Numbered steps beside a vertical line

A "how it works" column built as numbered items (01, 02, 03) with a rule running
down the side and the text set to the right is a slop layout, and a square-capped
line makes it worse. The numbered-list-on-a-rail is a preset. Compose a process
or sequence some other way, and never lean on a plain unrounded line to carry it.

## Stacking slop layouts (the compounding rule)

Any one of these compositions might be argued in isolation. Stacked in a single
page (a hero stack with a right panel, then a label-over-heading section, then
another, then a big-text-plus-subtext-plus-two-buttons block right before the
footer) they multiply into something unmistakably generated. The combination is
the loudest tell of all. A page is not the sum of individually acceptable blocks.
If it is built from a run of known slop skeletons, recolored and restacked, it is
slop no matter how clean each block looks on its own. Compose the page as one
whole, from the brief, and when a block matches an entry on this list, that is not
a green light because "the pieces are fine"; it means change it.

## The whole SaaS product-page template (the meta-skeleton)

The most generated layout on the internet, the Stripe / Linear / Vercel clone,
is an entire PAGE assembled out of these blocks in this exact order: a two-column
hero (headline plus subtext plus buttons on the left, a product or illustration
panel in a shadowed rounded box on the right), then a row of three feature cards
each with an icon in a tinted tile, then a "for shoppers / for stores" tabbed
switch, then two or three pricing cards, then a FAQ accordion, then a full-width
CTA slab carrying a headline, a byline and a button, then a multi-column footer
divided by rule lines. Every one of those blocks is already its own entry on this
list. Stacked in this sequence they are not a design, they are the default
template with the serial numbers filed off, and recoloring it green changes
nothing. If the page you are about to build is this stack, stop: you have not
designed anything, you have refilled a form. Decide a real signature first and
build the sections from the brand and the brief, so the page could not be
swapped, block for block, onto any other product. This is the layout to be most
suspicious of, because it is the one that feels "safe and professional" while
being pure slop.

## Labels and metadata as tinted pill chips, everywhere

Wrapping every scrap of metadata, a category, a status, a tag, "In stock", "Near
you", a distance, in a small text-in-a-tinted-rounded-pill is slop once it is the
reflexive default. A page peppered with little coloured label chips reads as a
component-kit dashboard, not a designed brand. Use real typographic hierarchy and
weight to rank information; reserve a chip for the rare case that genuinely needs
a contained status, not a pill around every noun.

## Dead controls and fake interactivity

A tab switch, an accordion, a slider, a toggle or a button that looks interactive
but does nothing when clicked, or visibly fails to respond, is slop and worse,
because it is simply broken. If you put a control on the page it must work, in the
browser, confirmed by an actual click. If a thing is only a static prop (a faux
search bar, a mock tab strip), do not dress it as a live control that invites a
click it cannot answer. (See the workflow: test every interactive control with a
real pointer before reporting.)

# The deeper tell: dodging this list is still slop

Everything above is surface. The real problem is making no creative decision.
You can avoid every single item on this list and still ship slop, because the
output reads as generated when nothing was actually invented. A checklist
produces a clean miss, not a design. These next entries are the ones that
caught a build that was *trying* to avoid the list.

## Even the "tasteful" font swap

Reaching for the safe designer alternative (Big Shoulders, Newsreader, IBM Plex
Mono, Instrument Serif, Bricolage, and so on) instead of Inter or Cormorant is
still slop. Any face chosen because it is the known "good" Google Fonts pick is
a tell. The family was never the issue; picking type by reputation instead of
by the brief is.

## The same skeleton, recolored

Documenting a layout as slop and then rebuilding it in new colors is still
slop. The split hero (kicker, oversized headline, subline, two actions, a panel
on the right) does not stop being a template because the palette changed. Flat
ink-on-paper is just a different coat of paint on the same prefab.

## The standard footer

A big wordmark with a one-line tagline, a full-width rule, four columns of link
lists under uppercase mono labels, another rule, then a copyright row with a
cute sign-off. Tidy, readable, expected. The "correct" footer with no idea in
it is slop.

## No icons at all

Over-correcting to zero icons is its own tell. Stripping every icon to dodge the
icon-pack look leaves a flat, lifeless interface, and is just as lazy as
dropping Lucide on everything. Real iconography is drawn for the brand, not
deleted to play it safe.

## Avoiding the list is not design

The deepest tell of all. Mechanically swapping one trendy font for another,
recoloring the same layout, ruling instead of bordering, removing icons to be
safe: each move dodges an item here while inventing nothing. Design is a point
of view (an idea about who this is for and why it should look like this),
applied with conviction. A checklist can only make work less wrong. It cannot
make it good.

# What premium actually looks like (craft, not avoidance)

Most "slop" techniques above are not banned forever. They are the lazy default
version of a real tool. Glass, accent edges, glowing light, borders and motion
all show up in genuinely premium work too. The difference is execution: craft,
restraint, and above all uniqueness. The same element is slop when it is the
obvious preset and premium when it is clearly made on purpose for this one
screen. These are the markers of the premium version.

## Real translucency (liquid glass)

Not a flat semi-transparent panel with a generic blur. Premium glass is a
material: it sits over a backdrop worth showing through (a photograph, a rich
color field, live content), it refracts and bends that backdrop, it carries a
faint chromatic dispersion at the edges, a bright inner highlight along the top
lip where light catches, a light frost, and tightly tuned inner plus drop
shadows for real depth. It reacts to what is behind it. Done this way,
transparency reads as expensive. The slop version is a frosted box with a blue
glow that ignores its background.

## Self-colored borders and tonal elevation

Define a container without drawing a line. Shift its surface value slightly
from the background (a hair lighter or darker), add a 1px stroke set to the
surface's OWN color at low opacity, and a soft inner highlight on the top edge.
The result is an edge you feel as a rounded lip catching light, not a drawn
outline. Depth and "pop" come from light and tone, not contrast. This is the
premium form of the hairline-border tell: the slop one is a hard contrasting
1px line on every box; this one is a seamless edge that you sense more than see.

## Bespoke geometry beats default shapes

Uniqueness is the single biggest premium signal. A plain straight accent bar on
a card is a preset (slop). The exact same idea becomes premium when the edge has
an invented silhouette: a marker that cuts in on a diagonal, runs straight down
the middle, then kicks back out on a diagonal at the base, a chamfer, a notch, a
custom bracket. The shape is specific, so it reads as drawn on purpose rather
than dropped in. Apply this to dividers, corners, connectors, container edges,
underlines: invent the geometry instead of accepting the rectangle.

## Bare icons, no container

Strip every icon to the mark itself. No tile, no chip, no colored rounded
square behind it. The premium move is removal: only what must be on screen is
on screen. (The inverse of the oversized-icon-in-a-tile tell.)

## Say less

Few words, short lines. Walls of copy and many stacked lines read as filler.
Premium interfaces are terse and let hierarchy, spacing and the visuals carry
the meaning. Cut every line that is not load-bearing. Confidence is shown by
how much you are willing to leave out.

## Custom, in-house iconography

Icons drawn as individual designed objects in one specific house style, not
pulled from a pack. A bespoke set, consistent in stroke, corner and grid, is
one of the clearest signals that a person designed this. (See "no icons at all"
above: the answer is not zero icons, it is your own icons.)

## Authored micro-interactions

Bespoke motion, not the default fade-and-translate. For example, on hover a line
travels and fills, with a rounded or slightly over-extended "popped" cap and
easing that feels deliberately tuned. Any shadow used in motion stays tight and
intentional so it never reads as cheap. The interaction should feel written for
this one element, not applied globally. Restraint plus specificity.

## Considered light, not the default glow

When light or glow is used, make the color specific and unexpected. A warm
volumetric amber wash or a single directional ray reads as art-directed; the
reflexive blue-to-purple bloom reads as slop. The glow is premium when someone
clearly chose its color, direction and falloff.

## Premium noise

A fine film grain or perlin-noise texture overlaid at very low opacity. It
breaks up flat fills and gradients, removes banding, and adds an analog, tactile
quality that makes a surface feel physical and expensive. The entire point is
subtlety: you should feel it, not see it.

## Liquid-glass button: a concrete recipe

Real parameter values from a glass-button spec, kept as a reference for what
"premium glass" is actually made of. Two variants (a thin glass pill and a
thick chunky one). All of it sits over a real photographic backdrop so the
refraction has something to bend.

Shared base:
- Fill: #2575FF. Thick variant drops fill to 50% opacity so the background reads
  through the glass; thin variant keeps it solid.
- Label + icon: #FFFFFF at 100%. Type: Geist Medium, 20. Icon-to-label gap: 8.
- Padding: 20 horizontal, 14 vertical.
- Two hairline strokes at 20% opacity, set to near-surface colors (one tinted
  cyan #22BBFD, one white #FFFFFF). These are self-colored edges, not a
  contrasting outline: the light lip from the section above.
- Inner shadow (top highlight): #FFFFFF, 20% opacity, offset Y 1, blur 32. This
  is the bright inner glow along the upper edge.
- Drop shadow: tinted to the FILL color #2575FF (not black), 6% opacity, offset
  Y 3, blur 3. A tight, color-matched shadow is the premium move; a soft black
  bloom is the slop one.

Glass material parameters:
- Thin pill:  Light angle -45deg, Light 80%. Refraction 80. Depth 2.
  Dispersion 40. Frost 6. Splay 0.
- Thick pill: Light angle -50deg, Light 60%. Refraction 64. Depth 44.
  Dispersion 67. Frost 2. Splay 20.

What each control means: Light angle/intensity is the specular highlight
direction and strength. Refraction is how hard the backdrop bends through the
glass. Depth is the apparent thickness (2 reads as a thin sheet, 44 as a thick
slab). Dispersion is chromatic aberration, the faint rainbow split at the edges.
Frost is blur. Splay is how far the refraction spreads past the shape.

CSS has no native refraction or dispersion, so approximate: backdrop-filter:
blur() (Frost) plus saturate()/contrast() for the lensing feel; an inset white
box-shadow for the top highlight; the two low-opacity strokes via layered
border or box-shadow; a tight color-matched drop shadow; and fake dispersion
with a 1px cyan/magenta offset on the edge or a thin conic/edge gradient. Always
place it over real content so there is something to refract. (SVG filters with
feDisplacementMap can do true refraction if it is worth the cost.)

## Premium type usually means licensed type

The least-slop reference sites do NOT reach for
the free Google defaults for their signature type. They license or self-host
real typefaces (Perfectly Nineties from Pangram Pangram, Matter from Displaay,
and peers like Soehne, GT America, Tiempos, Klim families) and pair them with a
neutral workhorse (Inter) and a mono (Fragment Mono, IBM Plex Mono). The
template-grade site (Droppable) is the one using only stock Google families.
You cannot always ship a paid face, but the principle holds: choose the
signature typeface as a deliberate brand decision, usually an editorial serif or
a characterful grotesque for display, paired with one clean neutral sans, not
whatever is trending on Google Fonts. Lift exact families from source, never
name them from memory.

## Full-page, large-scale composition

The most premium screens are composed as whole pages, not stacks of default
sections. Big confident scale: oversized headlines, an enormous brand wordmark
bleeding off an edge as a watermark, generous negative space, type and shapes
sized far past the timid default. The whole viewport is art-directed as one
frame.

## Real logo walls (earned social proof)

Recognizable company logos ("used in production by", a row of monochrome brand
marks) make a site read as legitimate and premium. Keep them tasteful: single
color, even sizing, quiet. Caveat: this only works with REAL brands you can
honestly claim. Inventing logos, or faking customers, is its own slop.

## Blueprint / canvas backgrounds

The faint engineering aesthetic: a fine module grid, ruler tick marks down an
edge, corner registration or crop marks, dashed guide lines, the look of a
design canvas. It evokes craft and process and reads as expensive when kept
subtle and monochrome. Buildable in CSS/SVG: repeating-linear-gradient grids,
small SVG tick and bracket marks at the corners, dashed 1px guides at low
opacity. (If a site's background art is fully bespoke illustration, that is a
different, harder tier.)

## Inset "island" sections

The pop-out trick. Instead of a full-bleed band welded to the page, float a
section as a rounded panel with consistent margin on ALL sides, sitting on a
different surface (often a subtly different color plus grain). The gap around
every edge makes it read as a detached, deliberate object rather than part of
the scroll. Common on footers and feature blocks. The all-sides breathing room
is the whole cue.

## Good: crafted custom SVG renders

A product or illustration hand-built in SVG with real care (correct proportions,
layered detail, considered color and light) is genuinely premium and the effort
shows. This is the opposite of the crude-CSS-illustration tell: the difference
is craft. When a bespoke SVG object is the strongest thing on the page, you did
it right.

## Good: the gloss is the good part of glass

On a glass surface, the clean specular sheen (the bright highlight raking across
the top) is the premium part and usually the part that works. What fails is the
blur and the shadow. So keep the gloss, and fix everything around it: blend the
blur, kill the leak, remove the resting halo, stop the pop.

## Professional does not mean lifeless

Restraint is not the same as nothing. The best work is clean AND has a few
authored creative moments. A correct, sparse, well-typed page with zero
invention still feels half-finished. Add considered creativity: clean, perfectly
aligned hover states; a row of logo or tag boxes that drift gently up and down;
a footer with oversized, precisely aligned typography carrying a unique texture;
a scroll-driven reveal; a kinetic detail. The bar is professional with a
heartbeat, not professional and asleep.

Sharper, because it keeps happening: a page can pass every rule on this list,
ship nothing disallowed, and still fail, because it did nothing. Correct spacing,
one tasteful image, quiet type and zero authored creative moments is not "premium
minimalism", it is unfinished work wearing restraint as an alibi. If there is no
wow, no signature that could only belong to this one brand, no motion that
responds to anything, no idea executed with real conviction, then the restraint
is just an excuse for having no point of view. Clean is the FLOOR, never the
achievement. Calm is a deliberate style and can be gorgeous; empty is a miss.
Decide the signature, then actually build something around it.

## The good grid: a fine textured micro-grid

The grid is only slop when it is a lazy, faint, full-page sheet of graph paper.
A precise, small, intentional module grid, kept tight and given a texture
(grain, a faint noise gradient, a considered edge), can be a premium surface,
especially behind a footer or a feature panel. The difference is craft and
restraint: a designed texture, not a default backdrop. If it looks like graph
paper, it failed; if it looks like a printed substrate, it works.

## Grainy gradients, never banded ones

A smooth gradient that bands into visible stripes is slop. The premium form is a
gradient with fine grain or noise dithered into it, so the transition is
seamless and the surface feels physical. Any large color transition should carry
grain. A "noise gradient" reads as expensive; a clean banded one reads as cheap.

## Scroll-authored motion

A premium creative layer: content that reveals, settles or shifts as it enters
the viewport, and quiet parallax between layers. Keep it subtle and fast, tied
to scroll position, and always gate it behind prefers-reduced-motion. Modern CSS
scroll-driven animation (animation-timeline: view()) can do most of this with no
JavaScript. Motion that responds to the user's scroll is one of the clearest
signals that a person designed the page.

## The oversized footer wordmark, placed right

The giant brand word at the bottom of a page is good, but only when placed
correctly. Two rules. First, it sits on the layer ABOVE the background texture
or grid, not buried behind it. Second, it is anchored flush to the very bottom
edge with NO gap beneath it, usually bleeding slightly off the bottom, while the
links and colophon sit above it. A huge wordmark with empty space below it, or
one hidden under the grid, is the failed version. Anchor it to the bottom,
clip it to the edge, and put it on top.

# The signature: how uniqueness is actually made

A page can be correct, sparse, well-typed and still be boring, because it has no
signature. "Clean" is the floor, not the goal. The reference sites (Craft,
Paper, Podqi, Droppable, Portal) look nothing alike, yet they make uniqueness
the same way. This is the formula, in design terms. A flat background with boxes
and a neutral grotesque scores zero on every line below, which is exactly why it
reads as boring.

## 1. One signature artifact

Every memorable hero has ONE custom, high-effort focal object that could not be
pasted into any other site. Craft: a torn-paper collage sky with clouds and
mountains. Portal: a painted dusk landscape with a tiny robot on a rock. Podqi:
a flowing green silk render. Droppable: a starfield with a bold green wordmark.
Paper: a layered design-tool canvas with a terminal window over it. Decide this
ONE thing first; everything else supports it. Offline, the signature is a
crafted SVG scene or object, a detailed CSS/SVG product mockup, or a
pre-generated image asset, never a flat fill.

## 2. Atmosphere, not a flat fill

The background is a composed environment with depth and mood (an illustration, a
render, a texture, a scene), not one flat color. Even the dark references carry
a starfield or particles; even the bright ones are a painted gradient sky. Flat
dark or flat cream behind boxes is the boring failure mode.

## 3. Layered depth on the z-axis

Three reads: foreground copy, a midground focal object (a product window, a
character), a background scene. At least one element crosses a layer boundary
(Paper's terminal overlapping the canvas, the product UI half-bleeding off the
bottom edge). Overlap and bleed make depth; one flat plane reads as a template.

## 4. The product as a real, populated artifact

When a product is shown, it is a detailed, fully-populated UI (Craft's doc
cards, Droppable's transfer list, Portal's invoice, Paper's canvas) floated and
tilted with depth, usually clipped at the bottom edge. Empty placeholder boxes
are the exact opposite, and they are what "boring" is made of.

## 5. Character in the display type

The headline face has personality and is set large: Craft and Portal use
distinctive serifs, Droppable a quirky vintage serif, Podqi a bold condensed
display. The identity never rests on a neutral grotesque. Body can be neutral;
the signature line cannot.

## 6. One bespoke silhouette

A single custom-cut shape signs the page: Droppable's pricing card shaped like a
receipt with a torn zigzag bottom edge; a contained pill nav; a notch. One
unmistakable geometry beats ten default rectangles.

## 7. The nav is treated, not defaulted

The menu bar is a decision, not a flush row of links. Craft and Portal float it
in a contained pill; others center it or give it real presence. Contain it,
center it, make it big, or thread real brand/company marks into it, but do
something deliberate.

## 8. Real specificity

Real recognizable logos in a wall (Podqi), real names and data inside the
product, real copy. Specifics read as true and considered; generic placeholders
read as a stock template.

## The formula

uniqueness = one signature artifact + atmosphere + layered depth + a character
display face + one bespoke silhouette + a treated nav + real specifics.

Miss the signature artifact and no amount of clean spacing rescues the page.
Even the most minimal premium site has at least the signature artifact and a
character face. Plain background + boxes + neutral grotesque is the boring
failure to stop shipping: decide the signature FIRST, then build the rest around
it.

# A kit of specific premium moves

Reusable techniques, each one a concrete option for a signature.

DISCLAIMER, and it applies to this entire file, not just this section. These are
tools for the right context, never a checklist to run top to bottom. There are
two equal and opposite failures:
- Using everything. Stacking a serif headline AND an ascii field AND glass AND a
  gradient icon AND a full-bleed scene makes noise, not a design. You do NOT
  need to use everything. Pick only the few moves that fit this brand and page.
- Using nothing that fits. Leaving a page flat and generic when it clearly calls
  for a signature is the boring failure. When a move is genuinely required, you
  DO use it.
The rule above both is cohesion: never use an element that does not complement
the others. Every choice must belong to one system. A technique that fights the
rest of the page is worse than not using it at all. Fit and restraint first,
then the right move exactly where it is needed.

## The signature serif headline

The single biggest driver of a premium feel. An elegant, slightly high-contrast
serif with real character, set very large, often with ONE word in italic and/or
a single accent color, the rest in ink. When unsure what to do with a headline,
this beats any grotesque. It is the practical form of "character display type":
a distinctive serif, two-tone or italic-accented, large.

## Two-tone / accent headline

Inside that headline, set one word or the second line apart: italic, or a single
accent color (a violet, an indigo, a brand hue), while the rest stays neutral.
It gives rhythm and a point of emphasis with no decoration. One emphasis per
headline, never a rainbow of colored words.

## Full-bleed atmospheric hero

A single photographic, rendered or painted scene that fills the ENTIRE hero edge
to edge (a nature landscape, a sky, a horizon, a soft 3D world), with the
headline centered over it and the nav floating on top. The background IS the art:
this is the signature artifact and atmosphere at maximum. The vibe to aim for is
serene and immersive, with elegant centered serif type over it. Offline this is
approximated with a crafted SVG scene, layered gradients with grain, or a
pre-generated image asset; never a flat fill.

## Animated character-field background

A field of scattered monospace glyphs (digits, punctuation, symbols, ASCII)
drifting over a soft iridescent gradient, faintly animated so the characters
twinkle or drift in a slow seamless loop. It reads as a data or code atmosphere
without a literal illustration, and the motion makes it feel alive. Keep it
low-contrast, behind the content, and gated behind reduced-motion. Strong fit
for data, dev, AI and security products. Buildable offline with CSS/SVG/canvas.

## Gradient-filled icons (a jewel inside the mark)

An icon or logo mark whose FILL is a multi-stop gradient (a lightning bolt, a
bloom, a shape with a colored gradient interior), not flat monochrome. Rare and
distinctive, like a small enamel jewel. This is the opposite of the slop
blue-purple background gradient: it is a tiny, contained, crafted detail inside a
custom SVG. Use it on the brand mark or a single eyebrow icon, sparingly.

## The arrow is a tell, so sweat it

The default horizontal right arrow on a CTA is everywhere and reads as a stock
component. An upward or outward diagonal arrow (pointing up-right) is a small,
distinctive, premium choice that signals someone cared. Draw a specific arrow and
match its stroke and corners to the rest of the system. The same goes for every
glyph: the icon set is part of the identity, not filler.

## One cohesive visual language ("synchronized edition")

The strongest pages feel like one system: nav, buttons, arrows, corner radius,
borders and background all speak the same language. Sharp corners everywhere, or
one specific arrow reused, or one gradient threaded through the icon, the button
and the background. Cohesion is itself a premium signal; a page assembled from
mismatched default components reads as cheap even when each part is fine. The nav
in particular must belong to the system, not be a default bar bolted on top.

## The premium glass CTA, when it earns it

A glossy, softly-blurred glass button over a rich background, executed cleanly
(gloss highlight, blur that blends, no leak, no pop), is a genuinely premium
call to action. It only works over an atmospheric background worth refracting;
over a flat fill it is pointless. The gloss is the part that sells it. (See the
liquid-glass recipe.)

## Use real component libraries, do not hand-roll generic UI

On a real framework (this is TanStack Start / React) you can pull in proper UI component
libraries and design systems, and you should, instead of hand-building every
button, toggle, nav and card from scratch. Reinventing the basics by hand tends
to reproduce the slop defaults: the sun-moon toggle, the fill-plus-outline button
pair, the underline hover. A considered, well-made component library or a real
design system is a legitimate, usually better foundation. Take its accessible,
functioning primitives and art-direct hard on top of them for the brand, rather
than shipping a worse hand-rolled copy of the same generic component. Do not
hand-roll generic UI when a real, tested component exists, and never let a
hand-built control ship broken.

### The standing toolkit (reach for these)

Hand-picked, all free to use. Default to these for foundations, full sections,
and animation instead of building from zero.

- Motion (motion.dev, the library formerly Framer Motion). `npm i motion`, import
  from `motion/react`. The animation ENGINE the others share, and the ONE that
  needs no Tailwind, so it works in any project regardless of styling system.
  Use it for springs, gestures, scroll-linked transforms (`useScroll`,
  `useTransform`), animated numbers, text effects, marquees, layout animation.
  (The "Motion AI Kit" at motion.dev/docs/ai-kit is a paid Motion+ MCP for
  editors, not free components; skip unless a Motion+ token is present.)
- shadcn/ui (ui.shadcn.com). React + Radix + Tailwind copy-paste primitives
  (button, dialog, tabs, accordion, form, table, command palette). The
  accessible foundation layer. Add via its CLI.
- tailark (tailark.com). Tailwind + shadcn marketing BLOCKS and full pages:
  heroes, features, pricing, testimonials, FAQ, CTAs, bento grids, footers.
- motion-primitives (motion-primitives.com). Motion + Tailwind animated
  components: text effects, infinite slider / marquee, animated tabs, accordion,
  cursor, transitions, morphing dialog.
- kokonut UI (kokonutui.com). Tailwind v4 + Motion, 100+ components including
  genuinely useful AI ones (AI input search, AI loading/text states, voice) plus
  text effects, particle/magnet buttons, flip/liquid-glass/bento cards, morphic
  navbars. Add via the shadcn CLI with the kokonut registry.

How to actually use them: shadcn, tailark, motion-primitives and kokonut are all
Tailwind based. If the project already has Tailwind wired up (check for a
`@import "tailwindcss"` or `tailwind.config`), install and use them directly. If
the project does NOT have Tailwind, install Motion and use it for the animation,
and ADAPT the structure and patterns of the others into the project's own
styling rather than dropping in Tailwind classes that will not apply. Never add
global Tailwind to a large existing non-Tailwind codebase just to use one block;
it can regress every other page.

### De-slop the prebuilt pieces, always

A free prebuilt block is a head start, not a free pass. These libraries still
ship plenty of slop on the defaults: blue-purple gradients, glowy pill buttons,
the fill-plus-outline button pair, sun-moon toggles, tracked-caps everywhere, the
default hero stack. The instant you spot a slop element in anything pulled from
them, you have full license to replace it, delete it, or rewrite it. Take the
accessible behaviour and the structure; throw away the generic styling and
art-direct it for the brand. Slop is never acceptable just because it came
pre-made. Run the prebuilt block through this whole file exactly like your own
work before it ships.

# Field notes: what actually landed

Distilled from builds that were accepted only after earlier ones were rejected.
These sit ON TOP of everything above; when in doubt, they win.

## Cohesion is the whole game

The loudest failure was not slop tells, it was INCOHERENCE: a page of
individually-fine parts (a font here, a colour there, a nice image) that did not
belong to each other. "Every small good part from a hundred feet away, made into
the ugliest thing." The fix that landed every time: pick ONE world and make every
element serve it.
- One palette, held with discipline. A monochrome or tightly-related set beats a
  mix. "Blue AND green AND a warm accent" read as ugly even though each was fine.
- One type voice. Never field two display faces that argue. Use a single family
  across weights/sizes (optical sizes are ideal), or one display + one quiet
  neutral, and nothing else.
- One signature artifact, decided FIRST, that the whole page is built around.
- Decide the world, then compose sections from it. A recoloured stack of blocks
  is still incoherent.

## "Creative" is not "realistic"

When the brief asks for creative or maximal, literal stock-style realism (a
photoreal lake, real water) reads as the OPPOSITE of creative. Reach for an
authored, artistic treatment in ONE consistent medium (cyanotype prints, a single
illustration style, pixel art, a riso look, a bright painted sky). A
limited-palette medium also makes every image auto-cohere and blend seamlessly
into the page (a cyanotype's own blue became the page's blue: zero seams).

## Type without the Google slop shelf

Fontshare (General Sans, Clash Display, Cabinet Grotesk, Satoshi, Switzer, …) is
free, licensed-quality and NOT the Google default rotation. Download the woff2 and
self-host via CSS `@font-face`. This is the practical way to get the "licensed,
distinctive" signature face the law demands without a paid licence.

## The product-as-artifact is a signature, not the slop window

A faux app window is a slop tell ONLY when it is empty and generic. A detailed,
fully-populated, real-feeling product UI (the actual editor, real diffs, real
copy, working controls), floated with depth and clipped at an edge, is one of the
strongest signatures there is. Build it as real interactive UI, not a picture.
BUT: only show a product UI when there IS one. If the product is literally just a
file, a fake dashboard/app window is nonsense and reads as a copied template.
Design from what the thing actually IS (show the file), not from a reference site.

## Take the design LANGUAGE from references, never the content

When given example sites for "this vibe", lift the language (palette mood, type
energy, motion, the kind of hero/footer) and then design ORIGINAL copy, layout
and artifact for THIS product. Reproducing a reference's headline and its product
window verbatim is copying, and it shows. Reference = direction, not a stencil.

## "Distinctive font" keeps moving: even the nice free grotesques read generic

Clash Display / General Sans (Fontshare) now read as the default startup look
too — the brief-giver called them generic slop. Reach further for character
(Fontshare Pally, Gambarino, Sentient, Tanker; Velvetyne faces) and pair the
signature display with a TRUE neutral body (system-ui is genuinely neutral and
safe; it is not a "chosen trendy font"). View candidates rendered before picking.

## Dead-looking is a fail on its own

"Boring / static / the menu has no animation" is a real rejection even when
nothing is slop. Put authored, purposeful motion on the page: a nav that enters
and responds, a signature that drifts/floats, scroll-linked parallax, crafted
hovers. Calm is allowed; dead is not. (Still: never gate content on a reveal —
animate y, not opacity-to-0.)



---

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!--  END — the pols.dev anti-slop design law  ·  https://pols.dev/slop.md    -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
