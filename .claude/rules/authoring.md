---
paths:
  - ".claude/skills/**/*.md"
  - ".claude/agents/*.md"
  - ".claude/rules/*.md"
  - "AGENTS.md"
  - "docs/**/*.md"
---

# Authoring Instruction Documents (not caught by linters)

Applies to text that **instructs** — a procedure someone executes against other
files. ADRs and audit records describe state rather than direct action, so the
restatement rule below is aimed at procedures rather than at them.

The claim-checking rule below applies to all of it, records included. An
earlier revision scoped this file to `docs/*.md` only, on the reasoning that
ADRs are records; an ADR amendment then shipped two invented claims — a
cross-reference to an ADR that says nothing of the kind, and a "this already
happened once" anecdote with no commit behind it. A reviewer caught both. The
scope now covers `docs/**` for exactly that reason.

No gate checks any of this. Typecheck, lint, knip, and tests all pass on a
document that is confidently wrong about every file it names, so the review
pipeline is the only check — which is exactly why these documents burn review
rounds when written carelessly.

## Point, don't restate

**Every sentence that restates another file's contents is a defect with a delay
fuse.** It is correct when written and wrong after the next edit to that file,
and nothing will tell you.

- Name the file and what to achieve; let the reader read it. "Strip every
  reference to the removed stack from `docs/DEPLOYMENT.md`" survives edits to
  that file. A bullet list of its individual lines does not.
- Enumerate only what a careful reader would **miss** — the non-obvious traps.
  A table whose rows all disappear leaves a dangling heading; a section that
  empties out may hold the only link to somewhere else; numbered headings need
  renumbering when one is dropped. Those are worth naming because reading alone
  does not surface them.
- Say so explicitly when you deliberately omit an enumeration, or the next
  author will helpfully add one back.
- A grep is a backstop, not the check. It only matches literals you predicted:
  a Japanese word, a paraphrase, or a capability description with no keyword
  all slip through. Never write "expect zero hits" as if it proved completeness.

## Check the sentence form as you write it

A claim about another file, another commit, or a tool's behaviour is either
checked or invented, and nothing downstream tells the two apart: the sentence
reads the same either way, and skipping the check leaves no trace in the
document. So the check cannot wait for a moment when you would notice it
missing. It has to attach to something visible while you type.

Four **sentence forms** are what to notice. You do not have to classify the
subject — the form alone is the trigger, and it fires in the same turn that
writes it:

| Form | Words that signal it | What discharges it |
|---|---|---|
| **Universal** | every / all / none / only / no other / always / never | the search that enumerates the set |
| **Completion** | was run / has been done / already / landed | the artifact or commit that records it |
| **Attribution** | landed in #N / added by X / `<file>` says Y | opening that file or commit now |
| **Quantity** | N cases / N flags / N files | counting them now |

A search "enumerates the set" only when it would also catch translations,
paraphrases, and keyword-free mentions — the grep caveat in "Point, don't
restate" above is not suspended for Universal claims, and it is not suspended by
narrowing the domain either: narrow what you claim, not the rigor of the search
inside it.

Opening the source is not the same as getting the sentence right, and the second
half fails on its own. Copy the value out of the source rather than recalling it
a paragraph later, and when you say what a file contains, describe the part you
read — not the part you expected to find.

When the evidence is not worth its cost, **drop the form** rather than assert
it: "mostly", "as of <date> I saw", "under `.claude/` I found none". A
downgraded sentence is not a weaker document — it is the honest shape of an
unchecked claim, and it tells the next reader exactly what is still open.
Narrowing a claim to the ground you actually covered counts as discharging it.

For claims about tool behaviour (what a CLI emits, what a flag defaults to),
run it in a scratch directory and cite the observation. Do not reason from
memory — the AGENTS.md Knowledge Currency rule applies with full force here.

Sweeping the finished draft for the same four forms is a backstop, not the
check. This rule used to be only that sweep, scheduled before dispatching
review — the moment momentum is highest and the work already feels finished, so
it was the first step to go, and going cost nothing visible because the reviewer
did it instead. Each such finding costs a full finder/verifier pair, because the
gate requires both to see the same tree.

## Keep the document consistent with itself

A procedure that names surfaces in several places must agree with itself.
Editing one step silently invalidates another: a step gains a file to edit while
the commit-split step still lists the old set; a keep-list grows while a
delete-list keeps the same item; a grep's path list contradicts the exclusion
rationale written three lines above it.

After changing any step, grep the document for every surface that step names and
reconcile the other mentions. Do this before dispatching, not after a reviewer
finds it.

## Size is a defect vector

Long procedures fail in a specific way: each fix creates a new inconsistency
somewhere else, so review rounds stop converging. If a document needs more than
a screenful of enumeration to stay correct, that is the signal to restructure it
around principles rather than to write the enumeration more carefully.

Evidence, recorded so this is not re-litigated: `.claude/skills/remove-db` told
forks to delete the Cloudflare deployment along with the database — caught by a
user hitting it, not by review. Rewriting it then took round after round of
review, and every finding was a stale or self-contradicting enumeration of
another file's contents; each round found a different one. What finally converged
was replacing those enumerations with the principle above.
