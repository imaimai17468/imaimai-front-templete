@AGENTS.md

## Plan-then-Auto workflow

When the user asks for planning — phrases such as "plan ...", "design ...", "think through ...", "計画して", "plan 組んで", "設計して", "考えて" — you MUST enter `EnterPlanMode` first and present a plan for approval, **even when Auto mode is active**. Only proceed to implementation after the plan is approved via `ExitPlanMode`. Do not skip this step unless the user explicitly says something like "skip the plan", "just implement", "計画なしで進めて", or "すぐ実装して".

### Plan content requirements

Before presenting the plan via `ExitPlanMode`, you MUST:

1. **Consult Aegis** — call `aegis_compile_context` with the files you intend to touch and the user's request as `plan`. The returned guidelines and any deferred docs MUST shape the plan content. Cite the relevant `doc_id`s in the plan.
2. **Reference existing ADRs** — scan `docs/adr/` and link any ADR whose decision constrains the plan. If the plan introduces a new architectural decision, note that a new ADR (`docs/adr/NNNN-<slug>.md`) will be authored as part of the work.
3. **Use the `superpowers:writing-plans` skill format** — invoke `Skill("superpowers:writing-plans")` to load the canonical plan structure (goal / context / steps / verification). The plan saved to disk MUST follow that format.
4. **Persist the plan** — `plansDirectory` is set to `./.claude/plans/`, so plan-mode output is saved there automatically. If for any reason it is not persisted by the harness, write it manually as `./.claude/plans/<YYYYMMDD>-<slug>.md`.

For ticket-granularity work (implement a component, fix a non-trivial bug, refactor a module, add a feature), prefer invoking the `start-workflow` skill — it already orchestrates the clarify → plan → ADR → dispatch → review → commit sequence and integrates with both Aegis and superpowers.

<!-- aegis:start -->
## Aegis Process Enforcement

You MUST consult Aegis for every coding-related interaction — implementation tasks AND questions about architecture, patterns, or conventions. No exceptions.

### When Writing Code

1. **Create a Plan** — Before touching any file, articulate what you intend to do.
2. **Tag catalog (recommended once per session)** — Call `aegis_get_known_tags` to list approved-resolvable tags and obtain `knowledge_version` and `tag_catalog_hash` for caching. Call again when the catalog hash changes.
3. **Consult Aegis** — Call `aegis_compile_context` with:
   - `target_files`: the files you plan to edit
   - `plan`: your natural-language plan (optional but recommended)
   - `command`: the type of operation (scaffold, refactor, review, etc.)
   - `intent_tags` (recommended): tags chosen from the step-2 catalog — drives `expanded` context deterministically. Use `[]` to skip expanded context without using the server-side SLM tagger. Omit `intent_tags` only if you want the server SLM tagger (when enabled) to infer tags from `plan` instead (see ADR-004).
4. **Read and follow** the returned architecture guidelines.
   - `delivery: "inline"` — content is included; read it directly.
   - `delivery: "deferred"` — content is NOT included. You MUST Read the file via `source_path` before proceeding. Prioritize by `relevance` score (high first); skip only documents with very low relevance (< 0.25) unless specifically needed.
   - `delivery: "omitted"` — excluded by budget or policy. Increase `max_inline_bytes` or use `content_mode: "always"` if needed.
5. **Self-Review** — After writing code, check your implementation against the returned guidelines.
6. **Report Compile Misses** — If Aegis failed to provide a needed guideline:
   ```
   aegis_observe({
     event_type: "compile_miss",
     related_compile_id: "<from compile_context>",
     related_snapshot_id: "<from compile_context>",
     payload: {
       target_files: ["<files>"],
       review_comment: "<what was missing or insufficient>",
       target_doc_id: "<optional: base.documents[*].doc_id whose content was insufficient>",
       missing_doc: "<optional: doc_id that should have been returned but was not>"
     }
   })
   ```
   - `target_doc_id`: A doc_id from the **base.documents** section of the compile result whose content was insufficient. Do NOT use expanded or template doc_ids.
   - `missing_doc`: A doc_id that should have been included in the compile result but was absent.
   - If neither can be identified, `review_comment` alone is sufficient.

### When Answering Questions

If the user asks about architecture, patterns, conventions, or how to write code — even without requesting implementation:

1. **Identify representative files** — Find 1–3 real file paths in the codebase that are relevant to the question (e.g. `modules/Member/Application/Member/UpdateMemberInteractor.php`). Use directory listings or search if needed. Do NOT guess paths or use directories. **Do NOT read the files** — Aegis already has the relevant guidelines; reading files wastes tokens.
2. **Consult Aegis** — Call `aegis_compile_context` with:
   - `target_files`: the real file paths from step 1
   - `plan`: the user's question in natural language
   - `command`: `"review"`
   - `intent_tags` (optional): when `expanded` context is useful, call `aegis_get_known_tags` first, then pass a subset of tags (or `[]` to skip expanded).
3. **Answer using Aegis context** — Base your answer on the guidelines returned by Aegis, supplemented by your own knowledge. Cite specific guidelines when relevant. When documents include a `relevance` score, prioritize high-scoring documents and skim or skip low-scoring ones.

### When Knowledge Base Is Empty

If `aegis_compile_context` returns no documents, the knowledge base has not been populated yet.
Ask the user to run initial setup using the **admin surface** with `aegis_import_doc` to add architecture documents with `edge_hints`.

### Rules

- NEVER skip the Aegis consultation step — for both implementation and questions.
- NEVER ignore guidelines returned by Aegis.
- The compile_id and snapshot_id from the consultation are required for observation reporting.
<!-- aegis:end -->
