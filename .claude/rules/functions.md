---
description: "The shape a function takes so its branches can be reached: the decision separated from the effect, values the outside world owns arriving as arguments, and no path that only a test runs"
globs: "**/*.ts,**/*.tsx,**/*.js,**/*.sh"
alwaysApply: false
paths: "**/*.ts, **/*.tsx, **/*.js, **/*.sh"
---

# Functions

These hold for every function in the repository: a component, a gateway module, a script under `scripts/`, a lint plugin under `tools/`, a shell helper under `.claude/hooks/`. `react.md` states what render demands on top of them, and it demands more than these, because React calls a component again whenever it likes.

**Split the function that decides from the code that acts.** Where a function both branches and performs the effect, the branching becomes a function that maps its inputs to a value naming the outcome, and its caller performs what the value names. A discriminated union carries that value, so one arm's data cannot be read off another. The Stop gate is shaped this way: `.claude/hooks/stop-gate-decision.sh` holds `downgrade_cause`, `holds_code_relevant_file`, the assembly of the collected failures and every line the gate prints, while `.claude/hooks/stop-gate.sh` reads the payload, runs the steps and encodes the JSON.

**A value the outside world owns arrives as an argument.** The clock, a random source, an environment variable, a file on disk. Read one inside the function and the same arguments answer differently on the next machine, and a test has to build that world before it can reach a single branch. Under `src/` the Effect rules move the reading to a service the caller provides: `vite.config.ts` applies `effectRules` to `src/**`, where `effect/noGlobals` reports `new Date()`, `Date.now`, `Math.random`, `crypto.randomUUID`, `process.env` and `fetch`. Nothing reports the same read in `scripts/`, `tools/` or `.claude/hooks/`, so there it is the author who holds it.

**Every branch is reachable by passing values.** A test that builds a scratch directory, stubs a binary, or drives a UI to reach a branch pays that price for where the branch sits rather than for the branch. Move the branch into a function that takes what it decides on, and let the test call it. Where the setup is the subject, such as a check that the entry runs its steps in the right order, it stays.

**No path that only a test runs.** A function exports what its callers use. An exported setter, a parameter nothing but a test passes, and a flag that changes behavior under test each put the test on a path production never takes, and the branch it covers then breaks unobserved. A value a caller can genuinely set is an API, and that a test can start from it is a byproduct.
