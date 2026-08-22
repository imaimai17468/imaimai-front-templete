---
description: How a sentence is built in comments, instruction documents, commit messages, and replies, in English and Japanese: plain words, what a sentence is allowed to be about, precision, and the generated-text patterns to keep out
alwaysApply: true
---

# Prose

This governs every text a person reads: replies to the user, plans, reports, commit messages, PR descriptions, review comments, code comments, and instruction documents. Code Practices settles what such prose may take as its subject, and Knowledge Currency whether its claims are verified. This file settles how the sentence is built. Every rule here describes what a sentence does rather than which words it uses, so all of them hold in both languages, and the section that closes the file adds what applies to Japanese alone.

## Plain words

**Use the plain word for what happens, in language the reader already has.** A vivid image, a shorthand, or a coined term is cheaper to write and reads as insight, but it substitutes an impression for the mechanism, and it sounds most confident exactly where it is least specific. Name the condition and the consequence separately, each with its own plain verb: "is not detected", "fails", "is skipped".

**When handing a decision back, state the goal, where it stands, what blocks it, and how the options differ, in that order.** The blocker is the one thing the reader cannot reconstruct alone, so it must be a fact rather than an impression.

**Prefer the shorter, older word.** `use` over `utilize`, `to` over `in order to`. Which words mark generated text turns over every year or two, so no list of them stays current here. The durable test is whether the word narrows the meaning: `leverage`, `robust`, `seamless`, `comprehensive`, `crucial`, `不可欠`, `核心的`, `多角的`, `掘り下げる` all fail it, because deleting them changes nothing.

## What the sentence is about

Ask of every sentence whether it updates **the situation** or **the document**.

A sentence that updates the situation carries something new about the thing under discussion: what the code does, what a measurement returned, what someone decided, what is still undecided. Keep it.

A sentence that updates the document reports only how the text itself looks or what it will do next. `本章では〜を扱う`, `結論からいうと`, `ここまでは概念の説明に見えるだろう`, `次は〜を見る`, `まとめると`, "In this section we will explore". Delete it and read across the gap. Where the logic now jumps, rewrite it as the situation-side fact it was gesturing at.

Four document-side forms survive, and only at a boundary such as an opening or a close:

- Rejecting a misreading, with the misreading quoted exactly. A bare `誤解しないでほしいが` with nothing quoted does not qualify.
- Setting a question that a later passage answers.
- A request to the reader, such as a scope caveat.
- Opening and closing the frame of an example.

Shortening a document-side sentence does not save it. Cutting one down to a crisp declarative makes it read like a considered remark, and that is the most common way this rule gets evaded. Settle what the sentence is about before judging how it sounds.

## Sentence shape

Each shape below is read as machine-written, and each also costs the reader something specific. Density is what gets noticed: one instance is invisible, and the same shape returning at intervals becomes the whole impression. Budget them per file rather than per sentence, and measure before calling a file clean.

**Em dash: 5 per 1000 words of English.** Past that it carries work that punctuation should refuse, giving a subordinate clause the same weight as the main clause, so the reader cannot tell the instruction from its reason. Where the right side restates the left, delete it. Where it adds a condition, give it its own sentence. Japanese is stricter, below.

**Do not put the negation before the claim.** `not X, but Y` and `AではなくB` spend a clause on what is not the case. Write Y. Keep X where it is a misreading the reader would actually reach, quote it, and add the ground for rejecting it, which a counterfactual often supplies (`もしAなら〜だったはずだ`).

**Do not balance a pair of clauses around a semicolon.** The symmetry reads as insight and resists being checked. Delete the half that is not the instruction. Keep it only where it changes which way the reader decides a borderline case.

**Prefer two parallel items to three.** Three reads as a template filling itself, where two reads as chosen. An enumeration of things that genuinely number three is exempt, and announcing the count (`論点は3つあります`) is not.

**State an effect rather than its importance.** `stands as`, `a testament to`, `pivotal`, `significant`, `重要なのは〜である`. Where the effect is worth naming, name it.

**Name the source or drop the sentence.** `experts argue`, `studies show`, `it is widely held` imply a consensus that nothing backs.

**Vary the run.** Three or more long assertions in a row, or a run of short flat declaratives, both read as generated. Break the run with a sentence of the other length.

## Precision

Knowledge Currency decides whether a claim was checked. These decide whether the sentence says only as much as was checked.

**Keep a hedge that carries real uncertainty.** `かもしれない`, `だろう`, "appears to" are removable only where they weaken something the text has already established. Where they mark an unverified possibility, an inference from a log, or a doubt the reader would raise, flattening them into an assertion makes the text wrong.

**Do not collapse distinct things into one word.** Separate decisions, separate causes, and separate kinds of failure stay separate. Where several of them do reduce to one thing, say so in a sentence before naming it.

**State the mechanism when claiming a cause.** `AだとBになる` with the reason omitted is an assertion the reader cannot check.

**Do not write detection, prevention, or a guarantee as unconditional.** Give the condition: `〜が成り立つときに限り`, `〜しやすい`.

**Narrow the claim to what the example supports.** Where the example carries only part of it, the claim moves rather than the example.

## Japanese

**Do not use a dash in running text or in a heading.** Not the em dash `—`, the horizontal bar `―`, or the doubled `——`. Write a parenthetical with `（）`, and split a restatement into two sentences or join it with a comma. The en dash in a range or in a compound name such as `Curry–Howard` is exempt, as is anything inside a code block.

**Do not build a heading out of two elements joined by a rule or a dash.** Make it one natural phrase.

**Do not end a clause with an i-adjective plus `です`** (`難しいです`, `多いです`, `わかりやすいです`). Read its appearance as a symptom that the sentence has come loose from the ones around it, and rewrite the passage rather than the ending alone. `重要です` and other na-adjectives are unaffected.

**Do not run adversatives back to back.** `ただし`, `一方で`, `とはいえ`, `現実的には` arriving one after another balance the text without moving it.

**Write one claim once.** Do not summarize a passage immediately after writing it, and do not stage an exchange with an imagined reader. Where the reader would genuinely ask something, write the question.

## Sources

Distilled from k16shikano's writing norms, [japanese-tech-writing](https://gist.github.com/k16shikano/fd287c3133457c4fd8f5601d34aa817d) and [cognitive-rhythm-writing](https://gist.github.com/k16shikano/eb2929f13ed19c97188393d297be8432), which target book chapters and long-form articles. Their devices for sustaining a reader's momentum are left out on purpose, because the texts this file governs are read for reference rather than read through.
