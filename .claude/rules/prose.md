---
description: How a sentence is built in comments, instruction documents, commit messages, and replies, in English and Japanese: plain words, what a sentence is allowed to be about, precision, format, and the generated-text patterns to keep out
alwaysApply: true
---

# Prose

This governs every text a person reads: replies to the user, plans, reports, commit messages, PR descriptions, review comments, code comments, and instruction documents. Check a reply against these rules before sending it, including where the sentence names a category in one word or hands a decision back. Code Practices settles what such prose may take as its subject, and Knowledge Currency whether its claims are verified. This file settles how the sentence is built. Every rule here describes what a sentence does rather than which words it uses, so all of them hold in both languages, and two sections near the end add what applies to Japanese alone and what bounds the whole file.

## Plain words

**Use the plain word for what happens, in language the reader already has.** A vivid image, a shorthand, or a coined term is cheaper to write and reads as insight, but it substitutes an impression for the mechanism, and it sounds most confident exactly where it is least specific. Name the condition and the consequence separately, each with its own plain verb: "is not detected", "fails", "is skipped".

**Prefer the shorter, older word.** `use` over `utilize`, `to` over `in order to`. Which words mark generated text turns over every year or two, so no list of them stays current here. The durable test is whether the word narrows the meaning: `leverage`, `robust`, `seamless`, `comprehensive`, `crucial`, `不可欠`, `核心的`, `多角的`, `掘り下げる` all fail it, because deleting them changes nothing.

**Let the verb be the plain one.** `serves as`, `stands as`, `represents`, `boasts` are all `is` or `has`. `made a decision` is `decided`, and `has the ability to` is `can`.

**Name the actor.** `the check ensures X`, `the decision emerges`, `mistakes were made`, and `〜が担保される` all leave out who or what acts, which is how an unverified claim gets in without anyone owning it. Put the actor in the subject: which function, which gate, which person. Where the actor is the reader, write the imperative.

**Cut the word that adds heat rather than light.** `really`, `simply`, `actually`, `truly`, `fundamentally`, `非常に`, `まさに` raise the temperature of a claim without changing it. A hedge that carries real uncertainty is a different thing, and Precision below protects it.

**When handing a decision back, state the goal, where it stands, what blocks it, and how the options differ, in that order.** The blocker is the one thing the reader cannot reconstruct alone, so it must be a fact rather than an impression.

## Say the specific thing

**Apply the portability test.** A sentence that could move unchanged to another repository, another module, or another company is filler. Replace it with a fact, a mechanism, a number, a file path, or a consequence that belongs to this subject alone. `The implications are significant` and `速度が向上する` name nothing.

**Repeat the right word rather than rotating synonyms.** Calling one thing a gate, then a check, then a guard reads as variety and costs the reader the identity of the thing. Pick the term and keep it.

**Do not reach for a sweeping quantifier to add force.** `every`, `always`, `everyone`, `すべて` used to mean "many" claim more than was checked. A directive is the exception, because `never hand-edit it` states the rule's force rather than a measurement.

**Write one claim once.** Do not restate a point in new words to make a passage feel thorough, and do not summarize a passage immediately after writing it. Where a text circles the same claim more than twice, cut the repetitions.

## What the sentence is about

Ask of every sentence whether it updates **the situation** or **the document**.

A sentence that updates the situation carries something new about the thing under discussion: what the code does, what a measurement returned, what someone decided, what is still undecided. Keep it.

A sentence that updates the document reports only how the text itself looks, what it will do next, or how much weight to give what it just said. `本章では〜を扱う`, `結論からいうと`, `次は〜を見る`, `まとめると`, "In this section we will explore", "This distinction matters", "That last part matters more than it sounds". Delete it and read across the gap. Where the logic now jumps, rewrite it as the situation-side fact it was gesturing at.

Four document-side forms survive, and only at a boundary such as an opening or a close:

- Rejecting a misreading, with the misreading quoted exactly. A bare `誤解しないでほしいが` with nothing quoted does not qualify.
- Setting a question that a later passage answers.
- A request to the reader, such as a scope caveat.
- Opening and closing the frame of an example.

Shortening a document-side sentence does not save it. Cutting one down to a crisp declarative makes it read like a considered remark, and that is the most common way this rule gets evaded. Settle what the sentence is about before judging how it sounds.

## Sentence shape

Each shape below is read as machine-written, and each also costs the reader something specific. Density is what gets noticed: one instance is invisible, and the same shape returning at intervals becomes the whole impression. Budget them per file rather than per sentence, and measure before calling a file clean.

**Em dash: 5 per 1000 words of English.** Past that it carries work that punctuation should refuse, giving a subordinate clause the same weight as the main clause, so the reader cannot tell the instruction from its reason. Where the right side restates the left, delete it. Where it adds a condition, give it its own sentence. Japanese is stricter, below.

**Do not put the negation before the claim.** `not X, but Y`, `it is not X, it is Y`, `AではなくB`, and a run of `not a X. Not a Y. A Z.` all spend a clause on what is not the case. Write Y. Keep X where it is a misreading the reader would actually reach, quote it, and add the ground for rejecting it, which a counterfactual often supplies (`もしAなら〜だったはずだ`).

**Do not balance a pair of clauses around a semicolon, and do not close on an aphorism.** The symmetry reads as insight and resists being checked, and a final polished line turns a finished argument back into a slogan. End on the clearest concrete sentence the text already contains. Where a balanced half is worth keeping, keep it only because it changes which way the reader decides a borderline case.

**Do not set up a reveal.** A colon followed by a dramatic completion (`The detail that makes it work: a separate agent grades it`), a question you answer yourself (`The result? Devastating`), and a run-up before the point (`Here's the thing`, `It turns out`, `What most people miss`, `結論からいうと`) all delay a sentence you could simply write. Use the colon for a list, a label, or a quotation.

**Prefer two parallel items to three.** Three reads as a template filling itself, where two reads as chosen. An enumeration of things that genuinely number three is exempt, and announcing the count (`論点は3つあります`) is not.

**State an effect rather than its importance.** `a testament to`, `pivotal`, `significant`, `重要なのは〜である`. Where the effect is worth naming, name it. The same holds for a trailing participle that gestures at meaning (`highlighting its role in`, `〜を示している`), which either becomes a specific claim or goes.

**Name the source or drop the sentence.** `experts argue`, `studies show`, `it is widely held` imply a consensus that nothing backs.

**Vary the run.** Three or more long assertions in a row, or a run of short flat declaratives, both read as generated. Break the run with a sentence of the other length. Repeated openings, such as three consecutive sentences starting with the same subject, read the same way.

## Precision

Knowledge Currency decides whether a claim was checked. These decide whether the sentence says only as much as was checked.

**Keep a hedge that carries real uncertainty.** `かもしれない`, `だろう`, "appears to" are removable only where they weaken something the text has already established. Where they mark an unverified possibility, an inference from a log, or a doubt the reader would raise, flattening them into an assertion makes the text wrong.

**Do not collapse distinct things into one word.** Separate decisions, separate causes, and separate kinds of failure stay separate. Where several of them do reduce to one thing, say so in a sentence before naming it.

**State the mechanism when claiming a cause.** `AだとBになる` with the reason omitted is an assertion the reader cannot check.

**Do not write detection, prevention, or a guarantee as unconditional.** Give the condition: `〜が成り立つときに限り`, `〜しやすい`.

**Narrow the claim to what the example supports.** Where the example carries only part of it, the claim moves rather than the example.

## Format

**Format follows the content.** A bullet list is for items that are genuinely parallel, and an argument that moves from one step to the next belongs in prose, so numbering paragraphs (`The first wall is`, `The second wall is`) to disguise a list as prose fails both ways. A heading needs more than two sentences under it. Emoji stay out of headings.

**A label names an action, or points at a literal.** A heading, a table column, or a bullet lead holds no room for a mechanism, so a slot that asks for one noun takes the nearest image instead. `溶かした先` names nothing that happened where `入れた節` names the action, and a file path or a section title cannot become an image at all.

**A bold lead names a rule.** In the normative documents here it opens the paragraph and carries the rule's name, which is why these paragraphs have one. Bold scattered mid-sentence marks nothing, because emphasis everywhere is emphasis nowhere.

## Japanese

**Do not use a dash in running text or in a heading.** Not the em dash `—`, the horizontal bar `―`, or the doubled `——`. Write a parenthetical with `（）`, and split a restatement into two sentences or join it with a comma. The en dash in a range or in a compound name such as `Curry–Howard` is exempt, as is anything inside a code block.

**Do not build a heading out of two elements joined by a rule or a dash.** Make it one natural phrase.

**Do not end a clause with an i-adjective plus `です`** (`難しいです`, `多いです`, `わかりやすいです`). Read its appearance as a symptom that the sentence has come loose from the ones around it, and rewrite the passage rather than the ending alone. `重要です` and other na-adjectives are unaffected.

**Do not run adversatives back to back.** `ただし`, `一方で`, `とはいえ`, `現実的には` arriving one after another balance the text without moving it.

## Calibration

These rules cut what repeats and what overclaims. They do not license flattening a text toward a neutral middle, and applying them to someone else's writing means the minimum effective edit rather than a rewrite.

**Before cutting a flagged phrase, check whether cutting it loses meaning.** Where it does, it is content, and it stays or gets reworded. Where the author would defend it, it is a choice rather than a formula, and it stays.

**Match the register you are writing in.** A reply to the user, a commit message, and a rule are held to the same tests and read nothing alike. Bluntness, humor, and a first-person admission survive every rule here when they are the writer's own.
