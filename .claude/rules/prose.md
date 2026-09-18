---
description: "How a sentence is built and what a document carries, in comments, instruction documents, commit messages, PR bodies, and replies, in English and Japanese: plain words, what a sentence is allowed to be about, precision, where the decision sits, format, and the generated-text patterns to keep out"
alwaysApply: true
---

# Prose

This governs every text a person reads: replies to the user, plans, reports, commit messages, PR descriptions, review comments, code comments, and instruction documents. Read this file before drafting a PR body, an issue comment, or a review, because these rules decide what the draft is made of and a later pass only patches what the draft already committed to. Check a reply against them before sending it, including where the sentence names a category in one word or hands a decision back. Code Practices settles what such prose may take as its subject, and Knowledge Currency whether its claims are verified. This file settles how the sentence is built and what the document carries. Every rule here describes what a text does rather than which words it uses, so all of them hold in both languages.

## Plain words

**Use the plain word for what happens, in language the reader already has.** A vivid image, a shorthand, or a coined term is cheaper to write and reads as insight, but it substitutes an impression for the mechanism, and it sounds most confident exactly where it is least specific. Name the condition and the consequence separately, each with its own plain verb: "is not detected", "fails", "is skipped".

**Prefer the shorter, older word.** `use` over `utilize`, `to` over `in order to`. Which words mark generated text turns over every year or two, so no list of them stays current here. The durable test is whether the word narrows the meaning: `leverage`, `robust`, `seamless`, `comprehensive`, `crucial`, `不可欠`, `核心的`, `多角的`, `掘り下げる` all fail it, because deleting them changes nothing.

**Let the verb be the plain one.** `serves as`, `stands as`, `represents`, `boasts` are all `is` or `has`. `made a decision` is `decided`, and `has the ability to` is `can`.

**Report your own action with its object.** `畳んだ`, `引いた`, `寄せた` name a gesture and leave out what moved. Write which thing you changed and what it now is: which function you deleted, which default went from what to what.

**Name the actor.** `the check ensures X`, `the decision emerges`, `mistakes were made`, and `〜が担保される` all leave out who or what acts, which is how an unverified claim gets in without anyone owning it. Put the actor in the subject: which function, which gate, which person. Where the actor is the reader, write the imperative.

**Cut the word that adds heat rather than light.** `really`, `simply`, `actually`, `truly`, `fundamentally`, `非常に`, `まさに` raise the temperature of a claim without changing it. A hedge that carries real uncertainty is a different thing, and Precision below protects it.

**Anchor a term the reader may not hold to one they do, once.** Keep the file name, the type, the command in the report, because a reader given only the outcome cannot check it or carry it into the next conversation, and every later report then restarts from nothing. On first use, tie the term to a word the reader has used themselves, a place on screen, or work they did by hand. Use the name alone after that. Where you cannot tell what the reader holds, ask.

**Hand the reader the vocabulary they can act on, not the one you worked in.** A tool's output labels, an internal variable name, the nickname the task went by while you did it, and a term only one field holds (`tween`, `トゥイーン`) each put the reader where you were standing. Say what the thing does for them instead. The identifier they will type or click is what the rule above anchors and keeps; what goes is the word that only records how the work happened to be done. A name and an error message in the code are read the same way, by someone who never saw the work, so they take this rule too.

## Say the specific thing

**Apply the portability test.** A sentence that could move unchanged to another repository, another module, or another company is filler. Replace it with a fact, a mechanism, a number, a file path, or a consequence that belongs to this subject alone. `The implications are significant` and `速度が向上する` name nothing.

**Repeat the right word rather than rotating synonyms.** Calling one thing a gate, then a check, then a guard reads as variety and costs the reader the identity of the thing. Pick the term and keep it.

**Do not reach for a sweeping quantifier to add force.** `every`, `always`, `everyone`, `すべて` used to mean "many" claim more than was checked. A directive is the exception, because `never hand-edit it` states the rule's force rather than a measurement.

**Count the behavior, not the edits.** `2 本追加した` measures the diff, which the reader can already open. `none のときに描画されなくなった` tells them what is different when they run it. Where a number belongs in the sentence, let it count something the reader would observe.

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

Cutting a document-side sentence down to a crisp declarative does not save it, because it then reads like a considered remark, and that cut is the most common way this rule gets evaded. Settle what the sentence is about before judging how it sounds.

## Sentence shape

Each shape below is read as machine-written, and each also costs the reader something specific. Density is what gets noticed, so budget them per file rather than per sentence, and measure before calling a file clean.

**Em dash: 5 per 1000 words of English.** Past that it carries work that punctuation should refuse, giving a subordinate clause the same weight as the main clause, so the reader cannot tell the instruction from its reason. Where the right side restates the left, delete it. Where it adds a condition, give it its own sentence. Japanese is stricter, below.

**Do not put the negation before the claim.** `not X, but Y`, `it is not X, it is Y`, `AではなくB`, and a run of `not a X. Not a Y. A Z.` all spend a clause on what is not the case. Write Y. Keep X where it is a misreading the reader would actually reach, quote it, and add the ground for rejecting it, which a counterfactual often supplies (`もしAなら〜だったはずだ`).

**Do not balance a pair of clauses around a semicolon, and do not close on an aphorism.** The symmetry reads as insight and resists being checked, and a final polished line turns a finished argument back into a slogan. End on the clearest concrete sentence the text already contains. Where a balanced half is worth keeping, keep it only because it changes which way the reader decides a borderline case.

**Do not set up a reveal.** A colon followed by a dramatic completion (`The detail that makes it work: a separate agent grades it`), a question you answer yourself (`The result? Devastating`), and a run-up before the point (`Here's the thing`, `It turns out`, `What most people miss`, `結論からいうと`) all delay a sentence you could simply write. Use the colon for a list, a label, or a quotation.

**Put the word that answers the previous sentence near the front of the next one.** Where it arrives at the end, the reader holds the whole sentence unplaced until it lands, and a run of them reads as a list of facts with the connections left out. The same gap opens when the subject changes between adjacent sentences with nothing announcing the change.

**Prefer two parallel items to three.** Three reads as a template filling itself, where two reads as chosen. An enumeration of things that genuinely number three is exempt, and announcing the count (`論点は3つあります`) is not.

**State an effect rather than its importance.** `a testament to`, `pivotal`, `significant`, `重要なのは〜である`. Where the effect is worth naming, name it. The same holds for a trailing participle that gestures at meaning (`highlighting its role in`, `〜を示している`), which either becomes a specific claim or goes.

**Name the source or drop the sentence.** `experts argue`, `studies show`, `it is widely held` imply a consensus that nothing backs.

**Vary the run.** Three or more long assertions in a row, or a run of short flat declaratives, both read as generated. Break the run with a sentence of the other length. Repeated openings, such as three consecutive sentences starting with the same subject, read the same way.

## Precision

These decide whether the sentence says only as much as was checked, where Knowledge Currency decides whether it was.

**Keep a hedge that carries real uncertainty.** `かもしれない`, `だろう`, "appears to" are removable only where they weaken something the text has already established. Where they mark an unverified possibility, an inference from a log, or a doubt the reader would raise, flattening them into an assertion makes the text wrong.

**Do not collapse distinct things into one word.** Separate decisions, separate causes, and separate kinds of failure stay separate. Where several of them do reduce to one thing, say so in a sentence before naming it.

**State the mechanism when claiming a cause.** `AだとBになる` with the reason omitted is an assertion the reader cannot check.

**Do not write detection, prevention, or a guarantee as unconditional.** Give the condition: `〜が成り立つときに限り`, `〜しやすい`.

**Narrow the claim to what the example supports.** Where the example carries only part of it, the claim moves rather than the example.

## What the document includes

These decide what gets written and where it sits, where the sections above decide how each sentence is built.

**Open with what was decided.** A plan, a report, a PR body, or a review carries the decision and the reason it beat the alternative in its first lines, and the reasoning that produced it follows. Announcing the conclusion in place of stating it is the run-up Sentence shape refuses.

**Answer what the reader came to ask, and leave the diff to the diff.** Whoever reads a PR body, an issue comment, or a review reply can open the changed files, so walking them through the change spends their attention on what they already hold. Write what the diff cannot tell them: why this over the alternative, what it costs, what is still open.

**Give a point the room its consequence earns.** A judgment that could have gone the other way takes the space it needs, and a premise no reader would dispute takes one line or none. Where every point runs to the same length, the reader is left to work out which one decided the design.

**An option ruled out by a stated requirement gets that requirement and nothing else.** Writing its advantages, or balancing them against a drawback, gives a case nobody could adopt the same length as the design you adopted. Where several options were weighed, the ones you dropped go in a table of the option and the reason it lost, and the prose covers the option you took.

**Cut a section the decision survives without.** Ask it of each section once the document is written. A background, a glossary, an audience note, or a list of future extensions is written where the reader cannot follow the decision without it, and dropped where a template was the only thing asking for it.

**Open a finding with what someone does and what they then see.** The mechanism follows that. A finding that opens with the mechanism leaves the reader to derive the reproduction, and the one they derive may not be the one you found.

**Do not open a reply to a finding with agreement.** `仰るとおり` and `確かに` report your stance while leaving the reader unable to tell what you took the problem to be. Restate the problem in your own words first, then name the fix and link it. A wrong restatement is visible to them and gets corrected; agreement hides the same error.

**A review of code you will not write is advice.** On someone else's pull request, `〜するのはどうでしょうか` and `〜できないでしょうか` leave the decision with the author. `〜しませんか` invites, which presumes you share the work, and `直してください` asks for it outright, so once you write none of the code both leave only the demand behind. Where the author decides to defer, that decision carries no conditions from you.

**Write what you are doing, and nothing you have not committed to.** A comment on your own issue is a note to yourself: it records what you will do next and asks no one for approval, because no one is being asked. `あとで Issue を切ります`, added because the comment felt thin without it, puts work in the record that nobody assigned.

## Format

**Format follows the content.** A bullet list is for items that are genuinely parallel, and an argument that moves from one step to the next belongs in prose, so numbering paragraphs (`The first wall is`, `The second wall is`) to disguise a list as prose fails both ways. A heading needs more than two sentences under it. Emoji stay out of headings.

**A label names an action, or points at a literal.** A heading, a table column, or a bullet lead holds no room for a mechanism, so a slot that asks for one noun takes the nearest image instead. `溶かした先` names nothing that happened where `入れた節` names the action, and a file path or a section title cannot become an image at all.

**A bold lead names a rule.** In the normative documents here it opens the paragraph and carries the rule's name, which is why these paragraphs have one. Bold scattered mid-sentence marks nothing, because emphasis everywhere is emphasis nowhere. A comment on a pull request or an issue is short enough to be read whole, so a table or a bold run there directs attention that was never divided, and the reader reads the formatting as a claim about what matters.

**Do not carry your investigation's structure into what you post.** The categories you sorted findings into were built for sorting them. Whoever reads the comment arrives with a different question, so order it by what they have to decide next and write the passage again from there.

## Japanese

**Do not use a dash in running text or in a heading.** Not the em dash `—`, the horizontal bar `―`, or the doubled `——`. Write a parenthetical with `（）`, and split a restatement into two sentences or join it with a comma. The en dash in a range or in a compound name such as `Curry–Howard` is exempt, as is anything inside a code block.

**Do not build a heading out of two elements joined by a rule.** Make it one natural phrase.

**Do not end a clause with an i-adjective plus `です`** (`難しいです`, `多いです`, `わかりやすいです`). Read its appearance as a symptom that the sentence has come loose from the ones around it, and rewrite the passage rather than the ending alone. `重要です` and other na-adjectives are unaffected.

**Do not run adversatives back to back.** `ただし`, `一方で`, `とはいえ`, `現実的には` arriving one after another balance the text without moving it.

## Calibration

These rules cut what repeats and what overclaims. They do not license flattening a text toward a neutral middle, and applying them to someone else's writing means the minimum effective edit rather than a rewrite.

**Before cutting a flagged phrase, check whether cutting it loses meaning.** Where it does, it is content, and it stays or gets reworded. Where the author would defend it, it is a choice rather than a formula, and it stays.

**Match the register you are writing in.** A reply to the user, a commit message, and a rule are held to the same tests and read nothing alike. Bluntness, humor, and a first-person admission survive every rule here when they are the writer's own.
