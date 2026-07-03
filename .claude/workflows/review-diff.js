export const meta = {
  name: "review-diff",
  description:
    "Unified pre-commit review of the uncommitted diff: parallel finder lanes (bug hunt + AGENTS.md rules) -> adversarial verify -> ranked findings -> commit-gate stamp",
  whenToUse:
    'Review step of start-workflow, or whenever the uncommitted diff needs a full review before committing. Pass {effort: "high"} for extra finder lanes and multi-lens verification.',
  phases: [
    {
      title: "Graph",
      detail: "extract dependency subgraph for the diff",
      model: "haiku",
    },
    {
      title: "Find",
      detail: "parallel finder lanes over the uncommitted diff",
    },
    {
      title: "Verify",
      detail: "adversarial verification of each deduplicated candidate",
    },
    {
      title: "Stamp",
      detail: "create .claude/.review-stamp for the commit gate",
      model: "haiku",
    },
  ],
};

const effort = args && args.effort === "high" ? "high" : "standard";

// Model choice (AGENTS.md "Model selection"): every lane runs on sonnet —
// near-Opus quality on code review at a fraction of the cost (the rules lane
// inherits sonnet from the code-reviewer agent definition). Re-run with these
// set to "opus" only after a demonstrably weak run (false CONFIRMED verdicts,
// missed obvious bugs).
const FINDER_MODEL = "sonnet";
const VERIFY_MODEL = "sonnet";

const SEVERITY_ORDER = { critical: 0, major: 1, minor: 2 };
const VERDICT_ORDER = { CONFIRMED: 0, PLAUSIBLE: 1 };

const DIFF_INSTRUCTIONS = [
  "Target: the uncommitted diff of this repository.",
  "Run `git status`, `git diff HEAD`, and `git ls-files --others --exclude-standard`; read untracked files directly.",
  "If there are no uncommitted changes, return an empty findings array.",
  "Only report findings anchored in the diff: changed hunks, or code whose behavior the diff changes.",
].join(" ");

const FINDINGS_SCHEMA = {
  type: "object",
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["file", "line", "title", "description", "severity"],
        properties: {
          file: { type: "string", description: "repo-relative path" },
          line: {
            type: "number",
            description: "1-indexed line the finding anchors to",
          },
          title: {
            type: "string",
            description: "one-sentence statement of the problem",
          },
          description: {
            type: "string",
            description:
              "concrete failure scenario or rule violation, plus a concrete fix the author can apply",
          },
          severity: { type: "string", enum: ["critical", "major", "minor"] },
          rule: {
            type: "string",
            description: "the AGENTS.md rule violated (rules lane only)",
          },
        },
      },
    },
  },
};

const VERDICT_SCHEMA = {
  type: "object",
  required: ["verdict", "reasoning"],
  properties: {
    verdict: { type: "string", enum: ["CONFIRMED", "PLAUSIBLE", "REFUTED"] },
    severity: {
      type: "string",
      enum: ["critical", "major", "minor"],
      description: "regraded severity, only when it differs from the finding",
    },
    reasoning: {
      type: "string",
      description: "what you traced in the real code",
    },
  },
};

const GRAPH_SCHEMA = {
  type: "object",
  required: ["changed_files", "subgraph"],
  properties: {
    changed_files: { type: "array", items: { type: "string" } },
    subgraph: {
      type: "object",
      description: "depth-1 neighborhood of changed files from code-graph.json",
      additionalProperties: {
        type: "object",
        properties: {
          layer: { type: "string" },
          imports: { type: "array", items: { type: "string" } },
          imported_by: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

const BUG_LANES = [
  {
    key: "logic",
    focus:
      "logic errors and boundary conditions: off-by-one, inverted conditions, wrong operators, null/undefined handling, unhandled empty or extreme inputs",
  },
  {
    key: "state",
    focus:
      "concurrency and state management: race conditions, stale React state or closures, effects with wrong dependencies, shared mutable state, double submission",
  },
  {
    key: "integrity",
    focus:
      "error handling and data integrity: swallowed errors, missing failure paths, partial writes, inconsistent persisted state, missing validation at boundaries",
  },
  {
    key: "cleanup",
    focus:
      "cleanup: duplication, dead code, needless complexity, obvious performance problems, drift from surrounding conventions",
  },
];
if (effort === "high") {
  BUG_LANES.push(
    {
      key: "security",
      focus:
        "security: injection, missing authorization checks, secrets in code, unsafe deserialization, XSS/CSRF exposure",
    },
    {
      key: "contracts",
      focus:
        "types and contracts: type-safety escapes, API or schema contract breaks, changes that break existing consumers",
    }
  );
}

// ---- Phase 0: Graph (extract dependency subgraph for the diff) ----
phase("Graph");
const graphResult = await agent(
  `Extract the dependency subgraph for the current uncommitted diff.
1. Run \`git diff --name-only HEAD\` and \`git ls-files --others --exclude-standard\` to get the list of changed/new files.
2. Read \`.claude/code-graph.json\`. If it does not exist, run \`bun run graph\` first, then read it.
3. For each changed file that appears in the graph's nodes, collect it plus its depth-1 neighbors (direct imports and imported_by).
4. Return the changed_files list and the subgraph containing only those nodes.
If there are no changed files or the graph has no matching nodes, return {"changed_files": [], "subgraph": {}}.`,
  {
    label: "graph",
    phase: "Graph",
    model: "haiku",
    effort: "low",
    schema: GRAPH_SCHEMA,
  }
);

const graphContext =
  graphResult && Object.keys(graphResult.subgraph).length > 0
    ? `\nDependency graph for affected files (depth-1 neighborhood):\n${JSON.stringify(graphResult.subgraph)}\nChanged files: ${graphResult.changed_files.join(", ")}\nCONSTRAINT: Use this graph to understand impact. Do NOT explore or read files outside this graph unless a finding specifically requires verifying behavior in an unlisted file.\n`
    : "";

// ---- Phase 1: Find (barrier is intentional — dedup needs all lanes' output) ----
phase("Find");
const laneResults = await parallel([
  ...BUG_LANES.map(
    (lane) => () =>
      agent(
        `You are one finder lane in a multi-agent code review; your ONLY lens is ${lane.focus}. ${DIFF_INSTRUCTIONS}${graphContext} Dig deep within your lens and ignore everything outside it. Report every issue you find in your lens, including ones you are uncertain about — do NOT filter for importance or confidence; a separate adversarial verification stage does that. Every finding still needs a concrete failure scenario and a severity estimate.`,
        {
          label: `find:${lane.key}`,
          phase: "Find",
          model: FINDER_MODEL,
          schema: FINDINGS_SCHEMA,
        }
      ).then((r) => r && { lane: lane.key, findings: r.findings })
  ),
  () =>
    agent(
      `Follow your code-reviewer procedure on the uncommitted diff. In addition to AGENTS.md, read every path-scoped rule file under .claude/rules/ whose scope (listed in the AGENTS.md "Rules" section) matches files in the diff, and review against those rules too — they are NOT auto-loaded in your context. ${DIFF_INSTRUCTIONS}${graphContext} Map your severities to the schema: BLOCK -> critical, IMPORTANT -> major, MINOR -> minor, and set "rule" to the rule each finding violates. If you find no violations, return {"findings": []} — never output plain "APPROVE"; the structured schema replaces your usual report format.`,
      {
        label: "find:rules",
        phase: "Find",
        agentType: "code-reviewer",
        schema: FINDINGS_SCHEMA,
      }
    ).then((r) => r && { lane: "rules", findings: r.findings }),
]);

const lanes = laneResults.filter(Boolean);
const lanesFailed = laneResults.length - lanes.length;
const candidates = lanes.flatMap((r) =>
  r.findings.map((f) => ({ ...f, lane: r.lane }))
);

// Same (file, line) from two lanes is treated as one finding: keep the
// highest-severity candidate, retain the others' lane/title/severity in
// alsoFoundBy. Deliberate tradeoff (reviewed, accepted): two genuinely distinct
// defects anchored to the same line collapse into one verified finding, the
// loser surviving only as a breadcrumb — keying by title instead would break
// dedup entirely (lanes word the same bug differently) and double verify cost.
const byLocation = new Map();
candidates.forEach((c) => {
  const key = `${c.file}:${c.line}`;
  const existing = byLocation.get(key);
  if (!existing) {
    byLocation.set(key, { ...c, alsoFoundBy: [] });
  } else if (SEVERITY_ORDER[c.severity] < SEVERITY_ORDER[existing.severity]) {
    byLocation.set(key, {
      ...c,
      alsoFoundBy: [
        ...existing.alsoFoundBy,
        {
          lane: existing.lane,
          title: existing.title,
          severity: existing.severity,
        },
      ],
    });
  } else {
    existing.alsoFoundBy.push({
      lane: c.lane,
      title: c.title,
      severity: c.severity,
    });
  }
});
const deduped = [...byLocation.values()];
log(
  `Find: ${candidates.length} candidates -> ${deduped.length} after (file, line) dedup [${lanes
    .map((r) => `${r.lane}: ${r.findings.length}`)
    .join(", ")}]`
);

// ---- Phase 2: Verify (finder != verifier; skeptical fresh contexts) ----
const LENSES =
  effort === "high"
    ? [
        "correctness (is the claimed behavior actually wrong?)",
        "reproduction (walk the failure scenario step by step through the real code)",
        "scope (does the cited rule or expectation actually apply here?)",
      ]
    : [
        "reproduction (walk the failure scenario step by step through the real code)",
      ];

phase("Verify");
const judged = (
  await parallel(
    deduped.map(
      (finding) => () =>
        parallel(
          LENSES.map(
            (lens) => () =>
              agent(
                `Adversarially verify one code-review finding through the ${lens} lens.${graphContext} Try to REFUTE it by reading the actual code; if it cites an AGENTS.md rule, read AGENTS.md and respect rule scope qualifiers. Finding: ${JSON.stringify(
                  finding
                )}. Verdict: CONFIRMED only if you traced the failure or violation in the real code; PLAUSIBLE if credible but not fully traced; REFUTED if it does not hold. Default to REFUTED when uncertain.`,
                {
                  label: `verify:${finding.file}:${finding.line}`,
                  phase: "Verify",
                  model: VERIFY_MODEL,
                  schema: VERDICT_SCHEMA,
                }
              )
          )
        ).then((votes) => {
          const cast = votes.filter(Boolean);
          if (cast.length === 0) {
            // Fail closed: an unverifiable candidate is reported, not dropped.
            return {
              ...finding,
              verdict: "PLAUSIBLE",
              unverified: true,
              verification:
                "no verifier completed — unverified, treat with caution",
            };
          }
          const alive = cast.filter((v) => v.verdict !== "REFUTED");
          if (alive.length * 2 <= cast.length)
            return { ...finding, verdict: "REFUTED" };
          const confirmed = alive.find((v) => v.verdict === "CONFIRMED");
          // Severity: take the MOST severe regrade among surviving votes, not
          // the first confirming lens — lens order carries no severity meaning.
          const regrades = alive
            .map((v) => v.severity)
            .filter(Boolean)
            .toSorted((a, b) => SEVERITY_ORDER[a] - SEVERITY_ORDER[b]);
          return {
            ...finding,
            verdict: confirmed ? "CONFIRMED" : "PLAUSIBLE",
            severity: regrades[0] || finding.severity,
            verification: (confirmed || alive[0]).reasoning,
          };
        })
    )
  )
).filter(Boolean);

const findings = judged
  .filter((f) => f.verdict !== "REFUTED")
  .toSorted(
    (a, b) =>
      VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] ||
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
const unverified = findings.filter((f) => f.unverified).length;
log(
  `Verify: ${findings.length} survived (${unverified} unverified), ${judged.length - findings.length} refuted`
);

// ---- Phase 3: Stamp the commit gate — only when the review actually completed ----
// "Completed" means every finder lane finished AND verification actually ran:
// if there were candidates but none could be verified (systemic verifier
// outage), the review is not trustworthy and must not open the gate.
const verifyOutage = deduped.length > 0 && unverified === deduped.length;
let gateStamped = false;
if (lanesFailed === 0 && !verifyOutage) {
  phase("Stamp");
  const stampReply = await agent(
    "You are the final step of the review-diff pre-commit review workflow (ADR-0009). The review has just completed: every finder lane finished and all findings were adversarially verified. Creating the completion marker is the DESIGNED, legitimate mechanism by which a completed review opens the commit gate — you are not bypassing any control; the control is this workflow, and it has run. From the repository root run exactly: `touch .claude/.review-stamp && ls .claude/.review-stamp && echo STAMP_CONFIRMED` — then reply with the command output only.",
    { label: "stamp", phase: "Stamp", model: "haiku", effort: "low" }
  );
  // Marker check: an ls error message would still contain ".review-stamp",
  // so success is signalled by the trailing echo, which only runs after ls succeeds.
  gateStamped =
    typeof stampReply === "string" && stampReply.includes("STAMP_CONFIRMED");
  if (!gateStamped) {
    log(
      "Stamp: FAILED — .claude/.review-stamp not confirmed; the commit gate stays closed"
    );
  }
} else {
  log(
    `Stamp: skipped — ${
      lanesFailed > 0
        ? `${lanesFailed} finder lane(s) failed`
        : "no candidate could be verified (verifier outage)"
    }; the review is incomplete — re-run review-diff before committing`
  );
}

return {
  effort,
  gateStamped,
  findings,
  stats: {
    candidates: candidates.length,
    deduped: deduped.length,
    refuted: judged.length - findings.length,
    unverified,
    lanesFailed,
  },
};
