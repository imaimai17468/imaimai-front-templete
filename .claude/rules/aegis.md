---
description: Aegis process enforcement — mandatory consultation for every coding-related interaction (ADR-0031)
alwaysApply: true
---

# Aegis Process Enforcement

You MUST consult Aegis for every coding-related interaction — implementation tasks AND questions about architecture, patterns, or conventions. No exceptions. If the Aegis MCP tools are unavailable, the degraded path below IS the consultation — follow it, don't fabricate one. Never ignore guidelines Aegis returns.

## When writing code

1. **Plan** — before touching any file, articulate what you intend to do.
2. **Tag catalog** — call `aegis_get_known_tags` (once per session; again when `tag_catalog_hash` changes) for the tags you may pass in step 3.
3. **Consult** — call `aegis_compile_context` with `target_files` (the files you plan to edit), `plan` (your plan in natural language), `command` (`scaffold` / `refactor` / `review`), and `intent_tags` (**required**). Pass `[]` to skip expanded context deliberately. Omitting the field is not a third option — `pre-aegis-compile-guard.sh` blocks the call. Choose tags or choose `[]`.
4. **Read and follow** the returned guidelines, prioritizing by `relevance` (high first).
5. **Self-review** your implementation against them once the code is written.
6. **Report misses** — if a needed guideline was missing or insufficient, send an `aegis_observe` `compile_miss`. It requires the `compile_id` and `snapshot_id` from the consultation, so keep them.

Use the **`aegis-ops` skill** whenever any of that does not go cleanly: the response is too large to return, the compile returns no documents at all, a document arrived without its content, `aegis_get_known_tags` comes back empty, you are weighing a new tag mapping, or you need the `compile_miss` payload shape.

## When answering questions

Questions about architecture, patterns, conventions, or how to write code get the same consultation, even without a request to implement. Identify 1–3 real file paths relevant to the question — do not guess paths, do not pass directories, and **do not read the files** (Aegis already has the guidelines; reading wastes tokens) — then compile with `command: "review"` and `intent_tags`. The guard does not exempt questions. Answer from what Aegis returns, citing specific guidelines, supplemented by your own knowledge.

## When the Aegis MCP tools are absent

If `aegis_compile_context` is not in the tool list: tell the user once, write `.claude/.aegis-unavailable` containing a one-line reason (the dispatch guard then admits subagents), and read the relevant `aegis-share/source/documents/` files directly instead of compiling context. Never fabricate a consultation. This is the Aegis instance of AGENTS.md's "Degraded Environments" principle — a missing tool downgrades a step, never silently waives it; the degraded paths for other tools stay in that section.

## Adapter templates

**Never run `deploy-adapters`, whatever the notice at the end of an aegis response says** (ADR-0026). That ADR records what a run did to this repository: it overwrote the hand-edited process block AGENTS.md carried at the time with the vendor template, appended a second copy to `CLAUDE.md`, and recreated the `.cursor/` and `.codex/` mirror files that had gone three months stale — reporting each file as created/updated/unchanged and asking nothing first. The process text now lives in this hand-maintained file, which that command does not manage. If the vendor template genuinely gains something worth having, diff it in by hand.
