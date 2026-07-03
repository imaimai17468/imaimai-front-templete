export const meta = {
  name: "verify-spec",
  description:
    "Agent-based model checking of a state-machine spec: formalize -> parallel counterexample hunting -> adversarial trace replay (ADR-0010)",
  whenToUse:
    'Design step of start-workflow for interaction-complex features (wizards, auth/session flows, async guards, permission branching). Pass the spec path via args: {spec: "specs/<feature>.spec.md", depth?: 8}.',
  phases: [
    { title: "Formalize", detail: "normalize the spec and flag ambiguities" },
    { title: "Hunt", detail: "parallel counterexample search lanes" },
    {
      title: "Verify",
      detail: "step-by-step adversarial replay of each trace",
    },
  ],
};

// NOTE: the pipeline shape (schemas, severity/verdict tables, dedup with
// max-severity merge, adversarial verify, fail-closed accounting) deliberately
// parallels review-diff.js. Workflow scripts run in an isolated runtime with
// no module imports, so the shared shape cannot be extracted into a common
// helper — when changing one file, check the other.

const specPath = args && args.spec;
if (!specPath) {
  return {
    error:
      'args.spec is required — repo-relative path to the spec, e.g. {spec: "specs/checkout.spec.md"}',
  };
}
const rawDepth = args && args.depth;
if (rawDepth !== undefined && (!Number.isInteger(rawDepth) || rawDepth < 1)) {
  return {
    error: `args.depth must be a positive integer (got ${JSON.stringify(rawDepth)})`,
  };
}
const depth = rawDepth === undefined ? 8 : rawDepth;

// Same model policy as review-diff (AGENTS.md "Model selection"): sonnet for
// every lane; re-run on "opus" only after a demonstrably weak result.
const HUNTER_MODEL = "sonnet";
const VERIFY_MODEL = "sonnet";

const SEVERITY_ORDER = { critical: 0, major: 1, minor: 2 };
const VERDICT_ORDER = { CONFIRMED: 0, PLAUSIBLE: 1 };

const MACHINE_SCHEMA = {
  type: "object",
  required: [
    "states",
    "initial",
    "actions",
    "invariants",
    "forbiddenFlows",
    "requirements",
    "ambiguities",
  ],
  properties: {
    states: { type: "array", items: { type: "string" } },
    initial: { type: "string", description: "the initial state" },
    actions: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "from", "to", "requires", "ensures"],
        properties: {
          name: { type: "string" },
          from: { type: "string", description: "source state (or pattern)" },
          to: { type: "string", description: "target state" },
          requires: {
            type: "string",
            description: 'guard condition; "true" if unguarded',
          },
          ensures: {
            type: "string",
            description: 'postcondition; "none" if unspecified',
          },
        },
      },
    },
    invariants: { type: "array", items: { type: "string" } },
    forbiddenFlows: { type: "array", items: { type: "string" } },
    requirements: { type: "array", items: { type: "string" } },
    ambiguities: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "description", "severity"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          severity: { type: "string", enum: ["critical", "major", "minor"] },
        },
      },
    },
    file_graph: {
      type: "object",
      description:
        "depth-1 subgraph of source files related to the spec's states and actions, extracted from .claude/code-graph.json",
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

const TRACES_SCHEMA = {
  type: "object",
  required: ["counterexamples"],
  properties: {
    counterexamples: {
      type: "array",
      items: {
        type: "object",
        required: ["property", "trace", "explanation", "severity"],
        properties: {
          property: {
            type: "string",
            description:
              "the invariant / forbidden flow / liveness or refinement property being attacked",
          },
          trace: {
            type: "array",
            items: { type: "string" },
            description:
              'one step per entry: "state --action--> state (why the guard held)"',
          },
          explanation: {
            type: "string",
            description: "why the final state violates the property",
          },
          severity: { type: "string", enum: ["critical", "major", "minor"] },
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
    reasoning: {
      type: "string",
      description: "which step is illegal, or why the violation actually holds",
    },
  },
};

// ---- Phase 1: Formalize (fslc check analog) ----
phase("Formalize");
const machine = await agent(
  `Read the state-machine specification at ${specPath} (format documented in specs/README.md). Normalize it into the structured machine required by the output schema: every state, the initial state, every action as a (from -> to) transition with its requires guard and ensures postcondition, every invariant, every forbidden flow, every requirement. Then flag ambiguities: undefined or unreachable states, actions that plausibly need a guard but have none, nondeterministic transitions (same state + same action -> different targets), invariants referencing undefined vocabulary, requirements with no supporting action. Report ambiguities in the dedicated field — do NOT silently repair the spec. Also read .claude/code-graph.json (run \`bun run graph\` first if it does not exist). For each state or action in the spec that maps to a source file or module, look up that file in the graph and include its depth-1 neighborhood (the file plus its direct imports and imported_by) in the file_graph field. If no files can be mapped, return an empty file_graph object.`,
  {
    label: "formalize",
    phase: "Formalize",
    model: HUNTER_MODEL,
    schema: MACHINE_SCHEMA,
  }
);
if (!machine) {
  return {
    spec: specPath,
    error: "formalization failed — spec unreadable or agent error",
  };
}

// Cross-field consistency: the formalizer's output is model-generated — check
// it before trusting it as ground truth for the hunt. Issues surface as
// critical ambiguities rather than aborting, so the caller sees them.
const stateSet = new Set(machine.states);
const consistencyIssues = [
  ...(stateSet.has(machine.initial)
    ? []
    : [`initial state "${machine.initial}" is not in states`]),
  ...machine.actions.flatMap((a) =>
    ["from", "to"]
      .filter((k) => a[k] !== "*" && !stateSet.has(a[k]))
      .map((k) => `action "${a.name}" references unknown ${k} state "${a[k]}"`)
  ),
];
consistencyIssues.forEach((description) =>
  machine.ambiguities.push({
    title: "machine inconsistency",
    description,
    severity: "critical",
  })
);

// ---- Phase 2: Hunt (BMC / liveness / refinement analogs, heuristic not exhaustive) ----
const machineJson = JSON.stringify(machine);
const fileGraphContext =
  machine.file_graph && Object.keys(machine.file_graph).length > 0
    ? `\nSource file dependency graph for this spec:\n${JSON.stringify(machine.file_graph)}\nUse this to ground counterexamples in actual file dependencies.\n`
    : "";
const HUNT_PREAMBLE = `You are one counterexample-hunting lane in an agent-based model check of the spec at ${specPath}. The normalized machine: ${machineJson}.${fileGraphContext} Search traces of at most ${depth} steps starting from the initial state "${machine.initial}". Adversarial toolkit: back navigation, cancel, retry, page reload, double-click / double-submit, concurrent tabs, permission or session change mid-flow, network failure at any step. Every step of a trace must be a legal transition whose requires guard holds. Report every candidate you find, including uncertain ones — an independent verification stage replays each trace and discards invalid ones.`;

const LANES = [
  {
    key: "invariant",
    focus:
      "For each invariant, construct a legal trace ending in a state where the invariant is false.",
  },
  {
    key: "forbidden",
    focus: "For each forbidden flow, construct a legal trace that realizes it.",
  },
  {
    key: "liveness",
    focus:
      "Find deadlocks (non-terminal states with no enabled action), livelocks (cycles that can never reach a terminal state), and started flows that some user choice can make unfinishable.",
  },
  {
    key: "refinement",
    focus:
      "For each requirement, check whether the machine actually guarantees it: find a requirement with no supporting transition path, or a legal trace that satisfies every guard yet defeats the requirement's intent.",
  },
];

phase("Hunt");
const laneResults = await parallel(
  LANES.map(
    (lane) => () =>
      agent(`${HUNT_PREAMBLE} Your ONLY lens: ${lane.focus}`, {
        label: `hunt:${lane.key}`,
        phase: "Hunt",
        model: HUNTER_MODEL,
        schema: TRACES_SCHEMA,
      }).then(
        (r) => r && { lane: lane.key, counterexamples: r.counterexamples }
      )
  )
);
const lanes = laneResults.filter(Boolean);
const lanesFailed = laneResults.length - lanes.length;
if (lanes.length === 0) {
  // Fail closed: an outage must never read as "design verified clean".
  return {
    spec: specPath,
    depth,
    error:
      "every hunt lane failed — the spec was NOT searched; this is an outage, not a clean result. Re-run verify-spec.",
    ambiguities: machine.ambiguities,
    stats: { candidates: 0, deduped: 0, refuted: 0, lanesFailed },
  };
}
if (lanesFailed > 0) {
  log(
    `WARNING: ${lanesFailed} hunt lane(s) failed — coverage is partial; treat the result as incomplete`
  );
}
const candidates = lanes.flatMap((r) =>
  r.counterexamples.map((c) => ({ ...c, lane: r.lane }))
);

// Dedup attacks on the same property. Traces are free text, so exact-match
// keys almost never collide across lanes — key on (property, trace length) as
// a same-attack heuristic, keep the most severe candidate, and record the
// losers in alsoFoundBy (same merge policy as review-diff.js).
const byAttack = new Map();
candidates.forEach((c) => {
  const key = `${c.property}::${c.trace.length}`;
  const existing = byAttack.get(key);
  if (!existing) {
    byAttack.set(key, { ...c, alsoFoundBy: [] });
  } else if (SEVERITY_ORDER[c.severity] < SEVERITY_ORDER[existing.severity]) {
    byAttack.set(key, {
      ...c,
      alsoFoundBy: [
        ...existing.alsoFoundBy,
        { lane: existing.lane, severity: existing.severity },
      ],
    });
  } else {
    existing.alsoFoundBy.push({ lane: c.lane, severity: c.severity });
  }
});
const deduped = [...byAttack.values()];
log(
  `Hunt: ${candidates.length} candidates -> ${deduped.length} after dedup [${lanes
    .map((r) => `${r.lane}: ${r.counterexamples.length}`)
    .join(", ")}]`
);

// ---- Phase 3: Verify — hunter != verifier; every trace replayed step by step ----
phase("Verify");
const judged = (
  await parallel(
    deduped.map(
      (cex) => () =>
        agent(
          `Adversarially verify one counterexample from an agent-based model check of ${specPath}. Machine: ${machineJson}. Counterexample: ${JSON.stringify(
            cex
          )}. Replay the trace step by step and check: (1) it starts in the initial state "${machine.initial}"; (2) every step's action exists in the machine and its requires guard holds in that step's source state; (3) the claimed violation actually holds at the end (for liveness: no enabled action escapes the deadlock/livelock); (4) the trace is at most ${depth} steps. REFUTED if any check fails. Default to REFUTED when uncertain.`,
          {
            label: `verify:${cex.lane}`,
            phase: "Verify",
            model: VERIFY_MODEL,
            schema: VERDICT_SCHEMA,
          }
        ).then((v) =>
          v
            ? { ...cex, verdict: v.verdict, verification: v.reasoning }
            : {
                ...cex,
                verdict: "PLAUSIBLE",
                unverified: true,
                verification:
                  "no verifier completed — unverified, treat with caution",
              }
        )
    )
  )
).filter(Boolean);

const counterexamples = judged
  .filter((c) => c.verdict !== "REFUTED")
  .toSorted(
    (a, b) =>
      VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] ||
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
log(
  `Verify: ${counterexamples.length} survived, ${judged.length - counterexamples.length} refuted`
);

// Design-time advisory tool: no commit-gate stamp here (that is review-diff's
// job at commit time). The parent fixes the DESIGN for every CONFIRMED
// counterexample and re-runs before implementing.
return {
  spec: specPath,
  depth,
  // Partial hunt coverage must be visible to the caller, not buried in stats.
  incomplete: lanesFailed > 0,
  ambiguities: machine.ambiguities,
  counterexamples,
  stats: {
    candidates: candidates.length,
    deduped: deduped.length,
    refuted: judged.length - counterexamples.length,
    lanesFailed,
  },
};
