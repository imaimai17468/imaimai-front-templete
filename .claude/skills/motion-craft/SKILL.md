---
name: motion-craft
description: Unified animation and motion skill — Apple-style fluid interface design, Emil Kowalski's craft standards, and an animation vocabulary glossary. Use when designing, building, or reviewing any animation, transition, gesture, or motion effect. Covers springs, easing, gestures, interruptibility, performance, accessibility, and a reverse-lookup glossary for naming effects.
---

# Motion Craft

Everything you need to design, build, and review web animation — in one place.
Three concerns, one skill: **design philosophy** (how motion should feel),
**implementation reference** (exact values and techniques), and **review
standards** (how to audit animation code). Plus a vocabulary glossary for
naming effects precisely.

Read this before writing any animation code. Re-check the review standards
before calling the work done.

---

# Part 1 — Design Philosophy

How Apple builds interfaces that feel like an extension of you, translated for
the web. From Apple's WWDC design talks — chiefly *Designing Fluid Interfaces*
(WWDC 2018).

The through-line: **an interface feels alive when motion starts from the current
on-screen value, inherits the user's velocity, projects momentum forward, and
can be grabbed and reversed at any instant.** Springs make this natural because
they are inherently interruptible and velocity-aware.

## The Core Idea

> "When we align the interface to the way we think and move, something magical
> happens — it stops feeling like a computer and starts feeling like a seamless
> extension of us."

An interface is fluid when it behaves like the physical world: things respond
instantly, move continuously, carry momentum, resist at boundaries, and can be
redirected mid-motion.

Apple frames design as serving four human needs: **safety/predictability,
understanding, achievement, and joy.**

## 1. Response — kill latency

The moment lag appears, the feeling of directness "falls off a cliff."

- **Respond on pointer-down, not on release.** Highlight a button the instant
  it's pressed. Waiting for `click`/touch-up to show feedback feels dead.
- **Be vigilant about every latency.** Audit debounces, artificial timers,
  transition waits, and the ~300ms tap delay.
- **Feedback must be continuous *during* the interaction, not just at the end.**
  For a drag, slider, or drawer, update the UI 1:1 with the pointer the whole
  way through.

```css
.button:active {
  transform: scale(0.97);
  transition: transform 100ms ease-out;
}
```

## 2. Direct manipulation — 1:1 tracking

> "Touch and content should move together."

When the user drags something, it must stay glued to the finger — and respect
the offset from *where they grabbed it*. Snapping to the element's center on
grab breaks the illusion immediately.

- Use Pointer Events with `setPointerCapture` so tracking continues even when
  the pointer leaves the element's bounds.
- Track a short **velocity/position history** (last few `pointermove` events),
  not just the current point — you'll need velocity at release.

## 3. Interruptibility — the single most important principle

> "The thought and the gesture happen in parallel."

Every animation must be interruptible and redirectable at any moment.

- **Never lock out input during a transition.**
- **Always animate from the *presentation* (current) value, never the target
  value.** On interrupt, read the element's live on-screen transform and start
  the new animation from there. Starting from the logical/target value causes a
  visible jump.
- **Avoid CSS transitions and `@keyframes` for anything gesture-driven** —
  they can't be smoothly grabbed and reversed mid-flight.
- **When a gesture reverses, blend velocity — don't hard-cut it.** Spring
  libraries that carry velocity through a re-target avoid the "brick wall."
- **Decompose 2D motion into independent X and Y springs.** A single spring on
  a 2D distance desyncs when X and Y have different velocities.

## 4. Behavior over animation — use springs

> "Think of animation as a conversation between you and the object, not
> something prescribed by the interface."

A pre-scripted, fixed-duration animation can't respond to new input. A spring
can — new input just changes the target, and the motion stays continuous.

Apple's two designer-friendly parameters:
- **Damping ratio** — controls overshoot. `1.0` = critically damped, no bounce.
  `< 1.0` = overshoots and oscillates.
- **Response** — how quickly the value reaches the target, in seconds. Lower =
  snappier. **This is not "duration"** — a spring has no fixed duration.

**Defaults:**
- Start most UI at **damping `1.0`** (critically damped).
- Add bounce (**damping ~`0.8`**) **only when the gesture itself carried
  momentum** (a flick, a throw, a drag release).

**Concrete values Apple ships:**

| Interaction | Damping | Response |
| --- | --- | --- |
| Move / reposition (e.g. PiP) | `1.0` | `0.4` |
| Rotation | `0.8` | `0.4` |
| Drawer / sheet | `0.8` | `0.3` |

```js
import { animate } from 'motion';

// Critically damped default (no overshoot)
animate(el, { y: 0 }, { type: 'spring', bounce: 0, duration: 0.4 });

// Momentum interaction — a little bounce, only because a flick preceded it
animate(el, { y: target }, { type: 'spring', bounce: 0.2, duration: 0.4 });
```

## 5. Velocity handoff

When a gesture ends, the animation must **continue at the finger's exact
velocity**, so there's no visible seam between dragging and animating.

Pass the pointer's release velocity as the spring's initial velocity. Some
spring APIs want **relative** velocity — normalize:

```
relativeVelocity = gestureVelocity / (targetValue - currentValue)
```

## 6. Momentum projection

> "Take a small input and make a big output."

Don't snap to the nearest boundary from the *release point*. Use velocity to
**project the resting position** — then snap to the target nearest that
projected point.

Apple's exact projection function:

```js
function project(initialVelocity, decelerationRate = 0.998) {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

const projectedEndpoint = currentPosition + project(releaseVelocity);
const target = nearestSnapPoint(projectedEndpoint);
animateSpringTo(target, { velocity: releaseVelocity });
```

## 7. Spatial consistency

> "If something disappears one way, we expect it to emerge from where it came."

- **Enter and exit along the same path.** A panel that slides in from the right
  must dismiss to the right.
- **Anchor interactions to their source.** A menu or popover should originate
  from the element that triggered it — set `transform-origin` to the trigger.
- **Mirror the easing on reversible transitions.**

## 8. Hint in the direction of the gesture

Intermediate motion should telegraph where things are going — make the
in-between frames point at the outcome, not just interpolate blindly.

## 9. Rubber-banding — soft boundaries

At an edge, resist progressively instead of stopping hard.

```js
function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
```

## 10. Gesture design details

- **Tap:** highlight on touch-*down*, commit on touch-*up*. Add ~10px hysteresis
  and allow cancel-by-dragging-away.
- **Drag/swipe:** require a small movement threshold (~10px) before committing
  to a direction, then track 1:1.
- **Detect all plausible gestures in parallel from the first move**, then
  confidently cancel the losers once intent is clear.
- **Minimize disambiguation delays.** Double-tap detection delays single taps;
  only pay that cost where double-tap truly exists.

## 11. Frame-level smoothness

- Keep per-frame positional change below the perception threshold to avoid
  strobing.
- For very fast motion, a subtle **motion blur / stretch** reads better than a
  hard sharp streak.
- `requestAnimationFrame` is the web's display-synced clock. Animate only
  compositor-friendly properties — `transform` and `opacity`.

## 12. Materials & depth

Apple uses translucent materials as a floating functional layer. On the web,
approximate with `backdrop-filter`.

- **Build nav/toolbars/sheets as translucent layers** with content scrolling
  underneath — not opaque bars.
- **Material weight encodes hierarchy:** darker/heavier = structural,
  lighter = interactive. **Never stack a light translucent surface on another.**
- **Bigger surfaces should read as thicker:** stronger blur + deeper shadow.
- **Scroll edge effects, not hard dividers.** Fade a gradient mask where
  content meets floating chrome.
- **Materialize, don't just fade.** Animate blur radius and scale together on
  enter/exit, so the surface reads as a real material arriving.

```css
.toolbar {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px) saturate(180%);
  border-top: 1px solid rgba(255, 255, 255, 0.4);
}
```

## 13. Multimodal feedback

Three rules for combining visual + sound + haptic:

1. **Causality** — trigger on the actual causal event, match character to action.
2. **Harmony** — visual, sound, and haptic must fire on the **same frame**.
3. **Utility** — reserve for meaningful moments (success, error, commit, snap).

## 14. Reduced motion & accessibility

Reduced motion means *gentler*, not zero. Respond to three independent signals:

- **`prefers-reduced-motion: reduce`** — replace slides/springs with short
  cross-fades. Drop elastic/overshoot. Keep opacity/color.
- **`prefers-reduced-transparency: reduce`** — frostier/solid surfaces.
- **`prefers-contrast: more`** — near-solid backgrounds with defined borders.

Avoid full-viewport moving backgrounds, slow looping oscillations (~0.2 Hz),
and abrupt brightness jumps.

```css
@media (prefers-reduced-motion: reduce) {
  .sheet { transition: opacity 200ms ease; transform: none !important; }
}
@media (prefers-reduced-transparency: reduce) {
  .toolbar { background: white; backdrop-filter: none; }
}
```

## 15. Typography — optical sizing, tracking, leading

- **Tracking is size-specific.** Large display text wants *negative* tracking;
  small text wants slightly *positive* tracking. Tighten headings, leave body
  near `0`.
- **Leading tracks size inversely.** Tight on large headings, looser on body.
- **Build hierarchy from weight + size + leading as a set,** not size alone.
- **Respect the user's text-size setting.** Scale layout with `rem`/`em`.

```css
.display {
  font-size: clamp(2rem, 5vw, 4rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-optical-sizing: auto;
}
```

## 16. Design foundations — Apple's eight principles

1. **Purpose.** Make with intention; decide what *not* to build.
2. **Agency.** Keep people in control: offer choices, easy undo.
3. **Responsibility.** Privacy: ask at the right moment, only for what's needed.
4. **Familiarity.** Build on what people already know. Things that look the same
   must behave the same.
5. **Flexibility.** Design for different contexts, devices, and abilities.
6. **Simplicity — not minimalism.** Strip the unnecessary so the core purpose
   shines; hiding everything in one place isn't simple.
7. **Craft.** Uncompromising attention to detail builds trust. Every spacing,
   timing, and alignment value is a deliberate choice.
8. **Delight.** The result of getting the other seven right, not confetti tacked
   on top.

## 17. Process

- **Prototype interactively — an interactive demo is worth "a million static
  designs."** You discover the interface by building and playing with it; a
  working prototype sets a concrete bar that prevents a mediocre final
  implementation.
- **Design interaction and visuals together.** "You shouldn't be able to tell
  where one ends and the other begins." Motion is not a layer added after the
  pixels.
- **Test with real people in real context**, and review motion with fresh
  eyes — play it in slow motion / frame-by-frame to catch what's invisible at
  full speed.

## Quick Reference

| Need | Technique | Concrete value |
| --- | --- | --- |
| Default UI spring | Critically damped, no overshoot | `damping 1.0`, `response 0.3-0.4` |
| Momentum / flick spring | Under-damped, slight bounce | `damping ~0.8`, `response 0.3-0.4` |
| Gesture -> spring velocity | Hand off release velocity | `gestureVelocity / (target - current)` if normalized |
| Flick landing point | Project momentum | `current + (v/1000)*d/(1-d)`, `d ~ 0.998` |
| Interrupt cleanly | Start from presentation (live) value | read the on-screen transform |
| Avoid reversal "brick wall" | Carry velocity through re-target | spring that blends velocity |
| Reversible transition | Mirror the easing curve | inverse cubic-bezier |
| Decide reverse vs. commit | Use velocity **sign**, not position | at release |
| 1:1 drag | Pointer Events + capture | respect the grab offset |
| Feedback | On pointer-down, continuous | never only at the end |
| Boundary | Rubber-band, don't hard-stop | progressive resistance |
| Translucent chrome | `backdrop-filter` layer | content scrolls under |
| Type tracking | Size-specific, never fixed | tighten large text (`-0.02em`), body near `0` |
| Reduced motion | Cross-fade, not slide/spring | `@media (prefers-reduced-motion)` |

---

# Part 2 — Implementation Reference

Precise values, curves, and techniques. Cite these in code and reviews.
Distilled from Emil Kowalski's design engineering philosophy (animations.dev).

## Frequency table — should it animate?

| Frequency | Decision |
| --- | --- |
| 100+/day (keyboard shortcuts, command palette) | No animation. Ever. |
| Tens/day (hover effects, list navigation) | Remove or drastically reduce |
| Occasional (modals, drawers, toasts) | Standard animation |
| Rare / first-time (onboarding, celebrations) | Can add delight |

**Never animate keyboard-initiated actions.**

## Easing

Decision order:
- Entering or exiting -> **`ease-out`**
- Moving / morphing on screen -> **`ease-in-out`**
- Hover / color change -> **`ease`**
- Constant motion (marquee, progress) -> **`linear`**
- Default -> **`ease-out`**

**Never `ease-in` on UI.** Built-in CSS easings are too weak. Use strong custom
curves:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);      /* iOS-like drawer */
```

Find curves at [easing.dev](https://easing.dev/) or
[easings.co](https://easings.co/).

## Duration

| Element | Duration |
| --- | --- |
| Button press feedback | 100-160ms |
| Tooltips, small popovers | 125-200ms |
| Dropdowns, selects | 150-250ms |
| Modals, drawers | 200-500ms |
| Marketing / explanatory | Can be longer |

**Rule: UI animations stay under 300ms.**

## Physicality

- **Never `scale(0)`.** Start from `scale(0.9-0.97)` + `opacity: 0`.
- **Origin-aware popovers.** Scale from the trigger, not center:
  ```css
  .popover { transform-origin: var(--radix-popover-content-transform-origin); }
  ```
  **Modals are exempt** — keep `transform-origin: center`.
- **Button press feedback.** `transform: scale(0.97)` on `:active`,
  `transition: transform 160ms ease-out`. Subtle (0.95-0.98).

## Springs

Feel natural because they simulate physics; no fixed duration.

```js
// Apple-style (recommended)
{ type: "spring", duration: 0.5, bounce: 0.2 }

// Traditional physics (more control)
{ type: "spring", mass: 1, stiffness: 100, damping: 10 }
```

Keep bounce subtle (0.1-0.3); reserve for drag-to-dismiss and playful
interactions. Springs maintain velocity when interrupted (keyframes restart
from zero).

| Need | Config |
| --- | --- |
| Default UI spring | `damping 1.0`, `response 0.3-0.4` |
| Momentum / flick spring | `damping ~0.8`, `response 0.3-0.4` |

## Interruptibility

CSS **transitions** can be interrupted and retargeted mid-animation;
**keyframes** restart from zero. For anything triggered rapidly, transitions
are smoother.

Use `@starting-style` for entry without JS:

```css
.toast {
  opacity: 1; transform: translateY(0);
  transition: opacity 400ms ease, transform 400ms ease;
  @starting-style { opacity: 0; transform: translateY(100%); }
}
```

## Asymmetric timing

Slow where the user is deciding, fast where the system responds.

```css
.overlay { transition: clip-path 200ms ease-out; }            /* release: fast */
.button:active .overlay { transition: clip-path 2s linear; }  /* press: slow */
```

## Performance

- **Only animate `transform` and `opacity`** — they skip layout/paint and run
  on the GPU. `padding`/`margin`/`height`/`width`/`top`/`left` trigger all
  three rendering steps.
- **Don't drive child transforms via a CSS variable on the parent** — it recalcs
  styles for all children. Set `transform` directly on the element.
- **Motion (Framer Motion) shorthands `x`/`y`/`scale` are NOT
  hardware-accelerated.** They run on the main thread via rAF and drop frames
  under load. Use the full transform string:
  ```jsx
  <motion.div animate={{ transform: "translateX(100px)" }} />
  ```
- **CSS animations beat JS under load** — they run off the main thread.
- **WAAPI** gives JS control with CSS performance:
  ```js
  element.animate(
    [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }],
    { duration: 1000, fill: 'forwards', easing: 'cubic-bezier(0.77, 0, 0.175, 1)' }
  );
  ```

## Transforms & clip-path

- **`translate` percentages** are relative to the element's own size —
  `translateY(100%)` moves by the element's height regardless of dimensions.
- **`scale()` scales children too** (font, icons, content).
- **3D**: `rotateX/Y` + `transform-style: preserve-3d` for depth/orbit/flip.
- **`clip-path: inset(t r b l)`** is a powerful animation tool: reveal-on-scroll,
  hold-to-delete overlay, seamless tab color transitions, comparison sliders.

## Gestures & drag

- **Momentum dismissal**: compute velocity (`Math.abs(distance)/elapsedMs`);
  dismiss if `> ~0.11`. A flick should be enough.
- **Damping at boundaries**: dragging past a natural edge moves less the
  further you go.
- **Pointer capture** once dragging starts.
- **Multi-touch protection**: ignore extra touch points after drag begins.
- **Friction over hard stops** — allow over-drag with rising resistance.

## Masking imperfect crossfades

When a crossfade shows two overlapping states, add subtle `filter: blur(2px)`
during the transition. Keep blur < 20px (heavy blur is expensive, especially
Safari).

## Stagger

Stagger group entrances; 30-80ms between items. Longer delays feel slow.
Stagger is decorative — never block interaction while it plays.

```css
.item { opacity: 0; transform: translateY(8px); animation: fadeIn 300ms ease-out forwards; }
.item:nth-child(2) { animation-delay: 50ms; }
.item:nth-child(3) { animation-delay: 100ms; }
```

## Accessibility (implementation)

```css
@media (prefers-reduced-motion: reduce) {
  .element { animation: fade 0.2s ease; }
}
@media (hover: hover) and (pointer: fine) {
  .element:hover { transform: scale(1.05); }
}
```

Reduced motion means fewer and gentler animations, not zero — keep transitions
that aid comprehension, remove movement/position changes.

## Debugging

- **Slow motion**: bump duration 2-5x or use DevTools animation inspector.
- **Frame-by-frame**: Chrome DevTools Animations panel.
- **Real devices** for gestures — connect a phone, hit the dev server by IP.
- **Fresh eyes next day** — imperfections invisible during development surface
  later.

---

# Part 3 — Review Standards

A specialized review posture for animation and motion code only. It does NOT
review general application logic, business code, or non-motion concerns. If
asked to review general code, decline and point to `review-diff` /
`code-reviewer`. Default to flagging; approval is earned.

## Operating Posture

You are a senior design engineer with a brutal eye for craft. Your bias is
toward **motion that feels right**, not motion that merely runs. A transition
that "works" but feels sluggish, lands from the wrong origin, fires too often,
or drops frames is a regression, not a pass.

## The Ten Non-Negotiable Standards

Every animation in the diff is measured against these. A violation is a finding.

1. **Justified motion.** Every animation must answer "why does this animate?" —
   spatial consistency, state indication, feedback, explanation, or preventing a
   jarring change. "It looks cool" on a frequently-seen element is a block.

2. **Frequency-appropriate.** Match motion to how often it's seen (see the
   frequency table in Part 2).

3. **Responsive easing.** Entering/exiting elements use `ease-out` or a strong
   custom curve. `ease-in` on UI is a block. Built-in CSS easings are too weak.

4. **Sub-300ms UI.** UI animations stay under 300ms; anything slower needs
   justification.

5. **Origin & physical correctness.** Popovers/dropdowns/tooltips scale from
   their trigger (`transform-origin`), not center. Never `scale(0)` — start
   from `scale(0.9-0.97)` + opacity. Modals are exempt.

6. **Interruptibility.** Rapidly-triggered motion (toasts, toggles) must be
   interruptible via CSS transitions that retarget from current state, not
   keyframes that restart from zero. Gesture-driven motion (drag, swipe)
   specifically requires springs or WAAPI — CSS transitions cannot receive
   release-velocity handoff (see Part 1 section 3).

7. **GPU-only properties.** Animate `transform` and `opacity` only.

8. **Accessibility.** `prefers-reduced-motion` is honored (gentler, not zero).
   Hover animations gated behind `@media (hover: hover) and (pointer: fine)`.

9. **Asymmetric enter/exit.** Deliberate actions animate slower; system
   responses snap. Symmetric timing on a press-and-release is a finding.

10. **Cohesion.** Motion matches the component's personality and the rest of the
    product. Mismatched personality is a finding. When unsure whether motion
    feels right, the strongest move is often to delete it.

## Aggressive Escalation Triggers

Flag these on sight:

- `transition: all`
- `scale(0)` or pure-fade entrances with no initial transform
- `ease-in` on any UI interaction; weak built-in easing on deliberate animation
- Animation on a keyboard shortcut or 100+/day action
- UI duration > 300ms with no stated reason
- `transform-origin: center` on a trigger-anchored popover/dropdown/tooltip
- Keyframes on toasts, toggles, or anything added/triggered rapidly
- Animating layout properties (`width`/`height`/`margin`/`padding`/`top`/`left`)
- Motion `x`/`y`/`scale` props on motion that runs while the page is busy
- Updating a CSS variable on a parent to drive a child transform
- Missing `prefers-reduced-motion` handling on movement
- Ungated `:hover` motion
- Symmetric enter/exit timing on a press-and-release
- Everything-at-once entrance where a 30-80ms stagger belongs

## Remedial Preference Hierarchy

When proposing fixes, prefer earlier moves over later ones:

1. **Delete the animation** (high-frequency / no purpose / keyboard-triggered).
2. **Reduce it** — shorter duration, smaller transform, fewer properties.
3. **Fix the easing** — swap `ease-in` -> `ease-out`/custom curve.
4. **Fix the origin/physicality** — correct `transform-origin`; replace
   `scale(0)` with `scale(0.95)` + opacity.
5. **Make it interruptible** — keyframes -> transitions/springs for gestures.
6. **Move it to the GPU** — layout props -> `transform`/`opacity`.
7. **Asymmetric timing** — slow the deliberate phase, snap the response.
8. **Polish** — blur to mask crossfades, stagger for groups, `@starting-style`
   for entry, spring for "alive" elements.
9. **Accessibility & cohesion** — add reduced-motion + hover gating; tune to
   match personality.

## Review Output Format

### Part 1 — Findings table (REQUIRED)

| Before | After | Why |
| --- | --- | --- |
| `transition: all 300ms` | `transition: transform 200ms ease-out` | `all` animates unintended properties off-GPU |
| `transform: scale(0)` | `transform: scale(0.95); opacity: 0` | Nothing appears from nothing |

### Part 2 — Verdict (REQUIRED)

Group by impact tier, highest first. Omit empty tiers.

1. **Feel-breaking regressions**
2. **Missed simplifications**
3. **Performance**
4. **Interruptibility & timing**
5. **Origin, physicality & cohesion**
6. **Accessibility**

Close with an explicit decision:

- **Block** — any feel-breaking regression, animation on keyboard/high-frequency
  action, `scale(0)`/`ease-in` on UI, or non-GPU animation with an easy GPU fix.
- **Approve** — no feel-breaking regressions, durations and easing within
  bounds, interruptibility handled, reduced-motion respected.

Cite `file:line`. Pull exact values from Part 2 rather than approximating.

## Guidelines

- Prefer CSS transitions / `@starting-style` / WAAPI for predetermined motion;
  JS / springs for dynamic, interruptible, gesture-driven motion.
- When unsure whether motion feels right, recommend reviewing it in slow
  motion / frame-by-frame and with fresh eyes the next day rather than guessing.

---

# Part 4 — Animation Vocabulary

Turn a vague description of a motion effect into the precise term, so you know
what to ask for. When the user describes an effect loosely, return the matching
term(s):

```
**Stagger** — Animate several items one after another with a small delay
between each, creating a cascade.
```

If several terms could fit, list the best match first, then 1-2 alternates with
a one-line note on how they differ.

## Entrances & Exits

- **Fade in / Fade out** — Element appears or disappears by changing opacity.
- **Slide in** — Element enters by sliding in from off-screen.
- **Scale in** — Element grows from smaller to full size, often paired with fade.
- **Pop in** — Element appears with a slight overshoot, like it bounces into place.
- **Reveal** — Content is uncovered gradually, often by animating a clip-path or mask.
- **Enter / Exit** — The animation an element plays when added to or removed from the screen.

## Sequencing & Timing

- **Keyframes** — Defined points in an animation that the browser fills between.
- **Interpolation / Tween** — Generating all in-between frames for continuous motion.
- **Stagger** — Animate several items one after another with a small delay.
- **Orchestration** — Timing multiple animations so they feel like one coordinated motion.
- **Delay** — Time before an animation starts.
- **Duration** — How long an animation takes.
- **Fill mode** — Whether an element keeps its first or last frame's styles before/after.
- **Stepped animation** — Divided into discrete steps, like a countdown timer.

## Movement & Transforms

- **Translate** — Move along the X or Y axis.
- **Scale** — Make bigger or smaller.
- **Rotate** — Spin around a point.
- **Skew** — Slant along an axis, shearing out of rectangular shape.
- **3D tilt / Flip** — Rotate in 3D space (rotateX / rotateY) for depth.
- **Perspective** — How strong the 3D effect looks.
- **Transform origin** — The anchor point a scale or rotation grows/spins from.
- **Origin-aware animation** — An element animates out of its trigger, not its own center.

## Transitions Between States

- **Crossfade** — One element fades out as another fades in, in the same spot.
- **Continuity transition** — Visually connecting before and after to keep the user oriented.
- **Morph** — One shape smoothly turns into another (e.g. Dynamic Island).
- **Shared element transition** — An element travels and transforms from one position into another.
- **Layout animation** — Size or position changes animate instead of snapping.
- **Accordion / Collapse** — Smoothly expands and collapses height.
- **Direction-aware transition** — Content slides one way going forward, opposite going back.

## Scroll

- **Scroll reveal** — Elements fade or slide in as they enter the viewport.
- **Scroll-driven animation** — Progress tied directly to scroll position.
- **Parallax** — Background and foreground move at different speeds.
- **Page transition** — Animation when navigating from one page to another.
- **View transition** — Browser morphs between two states, connecting shared elements.

## Feedback & Interaction

- **Hover effect** — Visual change when the cursor moves over an element.
- **Press / Tap feedback** — Subtle scale-down when clicked, so it feels physical.
- **Hold to confirm** — Progress effect that fills while the user holds a button.
- **Drag** — Moving an element by grabbing it, often with momentum on release.
- **Drag to reorder** — Dragging items in a list to rearrange while others shift.
- **Swipe to dismiss** — Dragging off-screen to close (drawer, toast).
- **Rubber-banding** — Resistance and snap-back when dragging past a boundary.
- **Shake / Wiggle** — Quick side-to-side jitter signaling an error.
- **Ripple** — Circle expanding from the point of a tap.

## Easing (glossary)

- **Easing** — Rate at which an animation speeds up or slows down.
- **Ease-out** — Starts fast, ends slow. The default for most UI.
- **Ease-in** — Starts slow, ends fast. Usually avoided; can feel sluggish.
- **Ease-in-out** — Slow, fast, slow. Good for on-screen A-to-B movement.
- **Linear** — Constant speed. Reserve for spinners or marquees.
- **Cubic-bezier** — Custom easing curve for precise control.
- **Asymmetric easing** — Accelerates and decelerates at different rates.

## Spring Animations

- **Spring** — Motion driven by physics (tension, mass, damping) rather than duration.
- **Stiffness / Tension** — How strongly the spring pulls toward its target.
- **Damping** — How quickly a spring settles. Lower = more bounce.
- **Mass** — How heavy the animated element feels.
- **Bounce** — A spring that overshoots and settles.
- **Perceptual duration** — How long a spring feels finished, even while micro-settling.
- **Momentum** — Motion that carries velocity, especially after a drag.
- **Velocity** — How fast and in which direction an element is moving.
- **Interruptible animation** — Smoothly redirected mid-flight instead of finishing first.

## Looping & Ambient Motion

- **Marquee** — Text or content that scrolls continuously in a loop.
- **Loop** — An animation that repeats.
- **Alternate (yoyo)** — A loop that plays forward then reverses each iteration.
- **Orbit** — An element circling around another.
- **Pulse** — Gentle repeating scale or opacity change.
- **Float** — Continuous up-and-down drift, making a static element feel alive.
- **Idle animation** — Subtle motion while an element is waiting to be interacted with.

## Polish & Effects

- **Blur** — Softening an element or masking imperfections.
- **Clip-path** — Clipping to a shape for reveals, masks, and before/after sliders.
- **Mask** — Hiding or revealing parts with soft, fadeable edges.
- **Before / after slider** — Draggable divider wiping between two overlaid images.
- **Line drawing** — SVG path that draws itself in.
- **Text morph** — Text animating character by character when it changes.
- **Skeleton / Shimmer** — Placeholder with a moving sheen during loading.
- **Number ticker** — Digits rolling or counting up to a value.
- **Tabular numbers** — Fixed-width digits so numbers don't shift as they change.
- **Typewriter** — Text appearing one character at a time.

## Performance (glossary)

- **Frame rate (FPS)** — Frames per second. 60fps is baseline; 120fps on newer displays.
- **Jank** — Visible stutter from dropped frames.
- **Dropped frame** — A frame the browser missed its deadline to draw.
- **Compositing** — GPU moving or fading an element on its own layer.
- **will-change** — CSS hint that an element is about to animate.
- **Layout thrashing** — Animating properties that force layout recalculation every frame.

## Principles

- **Purposeful animation** — Motion serves a function, not just decoration.
- **Anticipation** — Small wind-up in the opposite direction before a move.
- **Follow-through** — Parts keep moving and settle after the main motion stops.
- **Squash & stretch** — Deforming to convey weight, speed, and flexibility.
- **Perceived performance** — The right animation makes an interface feel faster.
- **Frequency of use** — The more often it's seen, the shorter and subtler it should be.
- **Spatial consistency** — Animate so elements keep identity and position across states.
- **Hardware acceleration** — Animating transform and opacity lets the GPU keep motion smooth.
- **Reduced motion** — Respecting the user's `prefers-reduced-motion` setting.
