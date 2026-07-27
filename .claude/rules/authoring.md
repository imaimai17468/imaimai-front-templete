---
paths:
  - ".claude/skills/**/*.md"
  - ".claude/agents/*.md"
  - ".claude/rules/*.md"
  - "AGENTS.md"
  - "docs/*.md"
---

# Authoring Instruction Documents (not caught by linters)

Applies to text that **instructs** — a procedure someone executes against other
files. ADRs and audit records describe state rather than direct action; they
still have to be accurate, but the restatement rule below is aimed at
procedures.

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

## Verify every claim before dispatching review

A claim about another file is either checked or invented. Before sending an
instruction document to review, open every file it names and confirm each
assertion: the path exists, the named section or key is really there, the
quoted behaviour matches, the line and section numbers are right.

This is not enforceable by any hook — it is a discipline, and skipping it is
invisible until a reviewer does the work for you. When that happens the finding
is always the same shape ("the doc says X, the file says Y"), and each one costs
a full finder/verifier pair because the gate requires both to see the same tree.

For claims about tool behaviour (what a CLI emits, what a flag defaults to),
run it in a scratch directory and cite the observation. Do not reason from
memory — the AGENTS.md Knowledge Currency rule applies with full force here.

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
