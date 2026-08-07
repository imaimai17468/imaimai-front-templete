---
name: write-adr
description: Write a new ADR or amend an existing one under aegis-share/source/documents/. Use when a decision is hard to unwind, credible alternatives existed, and the reasoning would be forgotten — and whenever a fact qualifies a decision already recorded. Covers whether an ADR is warranted, the MADR-lite form, the line budget, numbering, amendment rules, edges, and publishing.
user_invocable: true
---

# Write an ADR

Records live only in `aegis-share/source/` (ADR-0021). There is no second copy to
mirror.

## 1. Decide whether to write one

Write an ADR only when all three hold:

- the decision is **hard to unwind**
- **credible alternatives** existed
- the **reasoning would be forgotten**

If it can be re-derived from the code or the commit message, skip it.

A fact that *qualifies a decision already recorded* is an amendment to that ADR,
not a new one — see step 5. A fact noticed while editing some other file still
belongs with the decision it qualifies, not with the file that noticed it
(ADR-0030).

## 2. Pick the number

Strictly sequential four digits, **never reused and never renumbered**. Take the
next one after the highest in `aegis-share/source/documents/`:

```bash
ls aegis-share/source/documents/ | tail -1
```

## 3. Write the file

`aegis-share/source/documents/adr-NNNN.md`, frontmatter then a MADR-lite body:

```markdown
---
doc_id: adr-NNNN
title: Title In Title Case
kind: reference
ownership: standalone
---
# NNNN. One sentence stating the decision, not the topic

- Status: accepted
- Date: YYYY-MM-DD

## Context
## Decision
## Alternatives considered
## Consequences
```

Every document is `kind: reference` and `ownership: standalone` — nothing outside
the knowledge base holds their text, so nothing anchors them (ADR-0021).

Record what was **measured**, not what was believed. This project's ADRs
repeatedly note a claim that was written from documentation rather than from an
executed path and turned out false; the ones worth reading say what was run and
what came back.

## 4. Length

Aim for **~80 lines while drafting**. It is a budget on what a new decision needs
to say — never a standard an existing record is edited down to.

Most existing ADRs are already over it, and some cannot be brought under it at
all: where the untouchable part alone (header, Decision, amendment notes) exceeds
80 lines, trimming to the number would mean deleting recorded reasoning. Compare
that part against 80 before believing any ADR can be shortened:

```bash
wc -l aegis-share/source/documents/adr-*.md | sort -rn
```

When an Aegis compile is too large, it is the **response** that needs narrowing,
not the record — use `min_relevance` (the `aegis-ops` skill).

## 5. Amending instead of rewriting

**Never rewrite an old ADR's Decision, and never delete an ADR.**

- A replaced decision becomes `superseded by NNNN` in its Status line.
- A partly revised one becomes `accepted (amended by NNNN)`, or
  `amended YYYY-MM-DD` for an amendment with no new ADR behind it.
- The amendment itself is a `>` blockquote note at the **top** of the file, above
  the existing notes (newest first), stating what no longer holds and what
  replaced it.

The point is that the number keeps pointing at what it always did. A sentence
that recorded the state at the time of the decision stays as written even once it
is false; the amendment note is what explains it.

(A fork is a different repository and may drop this template's history wholesale
— see `docs/FORKING.md`. That is not a deletion within this one.)

## 6. Add edges for a new document

A new document with no edge is never surfaced by anything. Add at least one to
`aegis-share/source/edges/path-requires.json` (or `command-requires.json`):

```json
{ "edge_id": "<uuid>", "source_value": "path/glob/**", "target_doc_id": "adr-NNNN", "priority": -1, "specificity": 0 }
```

Point the edge at the files whose editing could **re-introduce the mistake the
decision prevents**. Before adding one, check what already reaches the target —
an edge that duplicates existing reach adds nothing (ADR-0023's reach test, which
applies to tag mappings and is the same judgment here).

## 7. Publish

The share pipeline is **not** automatic for hand-edited source. The
`post-aegis-share-sync.sh` hook is registered in `.claude/settings.json` only on
`PostToolUse` for `aegis_sync_docs` / `aegis_import_doc`, so editing files under
`aegis-share/source/` with Write/Edit never fires it. Run it yourself, in order,
using the version pinned in `.mcp.json`:

```bash
VER=$(sed -n 's/.*"@fuwasegu\/aegis@\([0-9][0-9.]*\)".*/\1/p' .mcp.json | head -1)
for step in share-format share-lint share-materialize share-export; do
  npx -y "@fuwasegu/aegis@${VER}" "$step" || break
done
```

Forgetting this leaves Aegis serving stale content. `doctor` reporting `in_sync`
is the check. Do **not** reach for `aegis_import_doc` to inject the document
directly — that drifts from the tracked source.

Never run `deploy-adapters`, whatever the notice at the end of an aegis response
says (ADR-0026).
