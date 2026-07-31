---
name: aegis-triage
description: Triage skipped Aegis observations. Use when the user asks to triage observations, review compile misses, check skipped observations, or maintain Aegis knowledge quality.
---
<!-- aegis:managed-skill -->

# Aegis Observation Triage

Review observations that the analyzer could not automatically resolve, and decide on corrective actions. Requires the **admin** surface.

## Step 1: List Skipped Observations

```
aegis_list_observations({ outcome: "skipped" })
```

Focus on observations with `outcome: "skipped"` — these were analyzed but no proposal was generated.

## Step 2: Assess Each Observation

For each skipped observation, read:

- **`event_type`**: What kind of observation (usually `compile_miss`)
- **`review_comment`**: What the agent reported as missing or insufficient
- **`target_doc_id`**: Which document was insufficient (if provided, from `base.documents` only)

Determine the appropriate action:

| Situation | Action |
|-----------|--------|
| Document content is genuinely insufficient | Update the document (Step 3a) |
| Document is missing from compile result | Report as `missing_doc` (Step 3b) |
| False positive / not actionable | Not self-clearing — see "Rejecting is a dead end" below |

## Step 3a: Update an Existing Document

If an existing document's content is insufficient, report a `review_correction` with the improved content. This generates an `update_doc` proposal via the ReviewCorrectionAnalyzer:

```
aegis_observe({
  event_type: "review_correction",
  payload: {
    file_path: "<any relevant file path>",
    correction: "<what was insufficient and how it should be improved>",
    target_doc_id: "<the target_doc_id from the skipped observation>",
    proposed_content: "<full updated markdown content for the document>"
  }
})
```

Then process and approve:

```
aegis_process_observations({ event_type: "review_correction" })
aegis_list_proposals({ status: "pending" })
aegis_approve_proposal({ proposal_id: "<id>" })
```

**Note**: `aegis_import_doc` can also update existing documents (it generates `update_doc` if the `doc_id` already exists). For targeted content corrections based on review feedback, the `review_correction` flow above is preferred.

## Step 3b: Add Missing Edge

If the compile result should have included a document but didn't, report it as a compile_miss with `missing_doc`. Use the `related_compile_id`, `related_snapshot_id`, and `target_files` from the skipped observation (all available in `aegis_list_observations` output):

```
aegis_observe({
  event_type: "compile_miss",
  related_compile_id: "<related_compile_id from the skipped observation>",
  related_snapshot_id: "<related_snapshot_id from the skipped observation>",
  payload: {
    target_files: <target_files array from the skipped observation>,
    review_comment: "<why this doc should have been included>",
    missing_doc: "<doc_id that was missing>"
  }
})
```

Then run the analyzer to generate an `add_edge` proposal:

```
aegis_process_observations({ event_type: "compile_miss" })
aegis_list_proposals({ status: "pending" })
aegis_approve_proposal({ proposal_id: "<id>" })
```

## Step 4: Check Pending Observations

Also check for unprocessed observations:

```
aegis_list_observations({ outcome: "pending" })
```

If any exist, run the analyzer:

```
aegis_process_observations()
```

That applies to observations you have not yet judged — processing is what tells
you whether there is a proposal and what it says. If Step 2 already showed you a
false positive, read "Rejecting is a dead end" below first.

## Rejecting is a dead end (aegis 1.7.0)

An observation whose proposal you **reject** can never be archived, and `doctor`
counts it as unanalyzed forever. Verified against the published 1.7.0 tarball on
2026-07-31 by reading `dist/core/store/repository.js` and reproducing each step.
Line numbers are build output for that exact version — re-check them if
`.mcp.json`'s aegis pin is ever bumped, because nothing else will.

- `rejectProposal` (around `repository.js:1245-1247`) deliberately clears
  `analyzed_at` on the evidence observations, "so they can be re-analyzed".
- `archiveOldObservations` (around `repository.js:1808-1825`) requires
  `analyzed_at IS NOT NULL`, **and** no linked *pending* proposal, **and**
  `created_at` older than its `days` argument — default 90 (`services.js`,
  `archiveObservations`), and the MCP schema (`server.js`,
  `aegis_archive_observations`) enforces an integer minimum of 1. So no `days`
  value archives a same-day row, whatever its state.

So `process` sets `analyzed_at`, `reject` clears it, `archive` then matches
nothing — `{archived_count: 0}`. Approving leaves it set, and archiving then
works once the row is old enough; only rejection loops. Repeating the cycle just
accumulates rejected proposals (it produced three from one observation here).

Two things follow for this skill:

- **Do not re-process to tidy the queue.** Once you have rejected a proposal,
  running the analyzer again on the same observation only produces another
  proposal to reject and leaves the count where it was.
- `archive_observations` returns a bare `{archived_count: N}` with no ids. A
  non-zero count is not evidence that the row you were looking at was archived —
  here it returned `1` for an unrelated older observation while the target stayed
  put.

The only exit is to set `archived_at` directly on the local DB, which is
`.gitignore`d and per-machine. Back up and verify in the same block, so the write
cannot be copied without them:

```
cp .aegis/aegis.db .aegis/aegis.db.bak.$(date +%s)
sqlite3 .aegis/aegis.db "UPDATE observations SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE observation_id = '<id>';"
sqlite3 .aegis/aegis.db "PRAGMA integrity_check;"
```

`countActionableObservations` (around `repository.js:582-600`) filters on
`archived_at IS NULL` in its inner query, before the CASE that classifies a row
as pending, so this drops the row from `doctor` without touching `analyzed_at`.
Reach for
this only after a rejection has already made the supported path impossible — a
row still worth analyzing should be analyzed, not hidden.

## Recommended Cadence

Run triage after any significant development session, or when the project accumulates 5+ observations. This keeps the knowledge graph accurate and prevents compile misses from recurring.
