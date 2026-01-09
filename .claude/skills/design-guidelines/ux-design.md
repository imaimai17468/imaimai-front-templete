# UX Design Guidelines

This document guides the design of intuitive human interfaces that feel natural and effortless. Apply these principles when making UX decisions, designing flows, or evaluating existing interfaces.

## Design Thinking

Before designing any interface, understand the cognitive context:

- **Mental Model**: How do users imagine this system works? Match their expectations, not your implementation.
- **Task Flow**: What are users trying to accomplish? Optimize for their goals, not your features.
- **Cognitive Budget**: Users have limited attention and energy. Every element costs mental effort.
- **Context**: Where, when, and how will this be used? Design for real conditions.

**CRITICAL**: The best interface is invisible. Users should accomplish goals without thinking about the tool itself.

## Core Principles

Design interfaces where users feel in control and actions feel natural:

- **Objects, not procedures**: Let users manipulate things directly. Don't force them through rigid step-by-step wizards. Extract the objects users care about and make them interactive.
- **Modeless and reversible**: Avoid modes where the same action means different things. Every action should be undoable. Users should work in any order they choose.
- **Immediate feedback**: Respond to every action within 400ms (Doherty Threshold). Silence feels broken. Show progress, confirm success, explain errors instantly.
- **Smart defaults**: Do the calculation for users. Offer optimal presets. Remember their preferences. Reduce decisions wherever possible—decision fatigue degrades everything.
- **Progressive disclosure**: Show basics first, details on demand. Don't overwhelm with everything at once, but don't hide things users need.
- **Prevent, don't report**: Design to make errors impossible before they happen. Constraints and smart defaults beat error messages every time.

Visual communication must be crystal clear:

- **Signifiers**: Clickable things must look clickable. Disabled things must look disabled. Never make users guess what's interactive.
- **Visual hierarchy**: Size, color, contrast, and position guide the eye. Most important = most prominent. First and last items are remembered best (serial position effect).
- **Gestalt grouping**: Proximity, similarity, and closure show relationships. Users see patterns before they read labels.
- **Consistency**: Same meaning = same appearance. Different meaning = different appearance. Consistency is how users learn your system.

## UX Psychology

Leverage cognitive biases and effects to create better experiences:

**Perception & Trust**: Beautiful interfaces feel easier to use (aesthetic-usability effect). Familiar patterns reduce friction (familiarity bias). First impressions anchor all later judgments (anchor effect). End experiences on a high note (peak-end rule).

**Motivation & Engagement**: Show what others do (social proof). Display progress toward goals—effort increases as completion approaches (goal gradient). Incomplete tasks stick in memory (Zeigarnik effect). Let users invest and customize—they'll value it more (endowment effect).

**Framing Matters**: How you present information shapes decisions. "90% success" feels different than "10% failure." Defaults are powerful—most users never change them. Use these effects ethically to guide users toward good outcomes.

**Attention is Precious**: Users ignore anything that looks like an ad (banner blindness). They focus only on what seems relevant (selective attention). Respect their cognitive limits—chunk information, create clear hierarchy, eliminate noise.

## Never Do

NEVER design interfaces that:

- Force rigid sequences when flexibility is possible
- Hide undo or make actions irreversible without warning
- Rely on user memory for information you could display
- Use jargon instead of user language
- Make users wait without feedback
- Trick users with dark patterns (fake scarcity, hidden costs, shame tactics)
- Ignore accessibility—everyone should be able to use the interface
- Assume you know users without testing with real people (empathy gap)

## Review Questions

When evaluating any interface decision, ask:

1. Does this match how users think about the problem?
2. Can users immediately tell what to do and what's clickable?
3. Are users in control, or is the system forcing them?
4. Could this cause errors? Could we prevent them instead?
5. Is this the simplest path to the goal?
6. Does this respect user attention and reduce cognitive load?
7. Would this work for users with different abilities and contexts?

Remember: Great UX feels like no UX at all. When users forget they're using software and just accomplish their goals, you've succeeded.
