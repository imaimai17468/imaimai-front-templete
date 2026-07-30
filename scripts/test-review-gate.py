"""Exercise the review-gate mechanism (ADR-0019) against the real hook scripts.

    python3 scripts/test-review-gate.py

Builds a throwaway git repository under the system temp directory, copies the
hooks into it, and drives the sequences the gate has to get right: a review, a
fix (which must never need a second review), a multi-commit split on one stamp,
and an unrelated unreviewed task. It also pins the distinction ADR-0022 turns
on — launching a review agent is not finishing one. (A verifier that stops
without reporting still stamps the gate today; that gap is intentional, recorded
in ADR-0022's Residual gap consequence, and is deliberately not asserted here —
a test asserting the opposite would fail forever.) Nothing touches this
repository, apart from reading `.claude/settings.json` to confirm the real
wiring.

Run it after changing any hook it drives — the `HOOKS` tuple below is the
authoritative list, including `lib-review-hash.sh`, which the pairing hooks source.
Prose duplicating that list goes stale the next time a hook is added, which already
happened once. Exits non-zero on a mismatch, so it works as a pre-flight check
rather than a report to read.
"""

import atexit
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

REPO = pathlib.Path(__file__).resolve().parent.parent
# A unique directory per run, removed at exit. A fixed shared path under the
# system temp dir would let two concurrent runs clobber each other, and the
# `rmtree` that kept it clean would delete whatever else occupied that name.
# `atexit` runs on a normal exit and on an uncaught exception, but not on SIGKILL,
# an OOM kill, or a segfault — a hard-killed run leaves its directory behind, and
# no later run will match the random name to clean it. Sweeping the prefix at
# startup would restore that self-healing and delete the live directory of a
# concurrent run, which is the bug this replaced, so it is deliberately not done.
_WORK_TMP = tempfile.TemporaryDirectory(prefix="review-gate-check-")
atexit.register(_WORK_TMP.cleanup)
WORK = pathlib.Path(_WORK_TMP.name)

# Split so this file's own text cannot look like a commit to the gate that
# matches `git <anything> commit` — see post-bash-stamp-consume.sh.
LAND = "git " + "com" + "mit"

HOOKS = (
    "pre-bash-guard.sh",
    "post-agent-review-stamp.sh",
    "post-bash-stamp-consume.sh",
    # The cycle-start clear and the pairing comparison (ADR-0015/0022). Driven as
    # real hooks so a case fails if either stops doing its job — writing the marker
    # files directly would pass no matter what these contain.
    "pre-agent-review-clear.sh",
    "pre-agent-review-pair.sh",
    # Included so the "a fix needs no second review" assertions below actually
    # exercise it. Writing the fixture file directly would pass whether or not
    # this hook still deletes the stamp, which is the regression that matters.
    "post-edit-check.sh",
    # Sourced by the two pre-agent hooks; without it they abort.
    "lib-review-hash.sh",
)

(WORK / ".claude/hooks").mkdir(parents=True)
for hook_name in HOOKS:
    shutil.copy(REPO / ".claude/hooks" / hook_name, WORK / ".claude/hooks" / hook_name)
os.chdir(WORK)
# Must match the real .gitignore's `.claude/.*` marker entries. A marker that is
# NOT ignored enters the working-tree hash, so writing it would change the hash it
# is about to be compared against — the gate would then never stamp.
pathlib.Path(".gitignore").write_text(
    "\n".join(
        f".claude/{name}"
        for name in (
            ".review-stamp",
            ".finder-done",
            ".finder-hash",
            ".pair-ok",
        )
    )
    + "\n"
)

failures = []


def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout.strip()


def hook(name, command):
    payload = {"tool_name": "Bash", "tool_input": {"command": command}}
    if name == "post-edit-check.sh":
        payload = {"tool_name": "Edit", "tool_input": {"file_path": command}}
    return subprocess.run(
        ["bash", f".claude/hooks/{name}"],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        env={**os.environ, "CLAUDE_PROJECT_DIR": str(WORK)},
    ).stdout.strip()


def raw_hook(name, payload, args=()):
    """Feed a hook an arbitrary payload, with the arguments its registration passes."""
    return subprocess.run(
        ["bash", f".claude/hooks/{name}", *args],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        env={**os.environ, "CLAUDE_PROJECT_DIR": str(WORK)},
    ).stdout.strip()


def dispatch(subagent_type):
    """Fire the PreToolUse(Agent) hooks for a dispatch, as the harness does.

    Both are registered on matcher `Agent` and each filters on
    `tool_input.subagent_type`, so both are invoked for every dispatch — running
    both here means a case fails if either starts reacting to the wrong agent.

    A verifier dispatch is where the pairing hash is *compared* (ADR-0022). The
    baseline it is compared against is recorded elsewhere — at the finder's
    completion, by `stop("finder")` — so that the compared window holds neither
    agent's own execution.
    """
    payload = {"tool_name": "Agent", "tool_input": {"subagent_type": subagent_type}}
    raw_hook("pre-agent-review-clear.sh", payload)
    return raw_hook("pre-agent-review-pair.sh", payload)


def stop(role, agent_type=None, message="findings: none surviving"):
    """Fire post-agent-review-stamp.sh exactly as its registration does.

    `.claude/settings.json` registers it twice under `SubagentStop`, once per
    matcher, passing `finder` or `verifier` as an argument — the role does NOT come
    from the payload. That indirection exists because 20 of 23 captured payloads
    carried `agent_type: ""` (ADR-0022). Pass `role=""` to exercise the
    argument-less fallback that still reads `agent_type`.
    """
    payload = {
        "hook_event_name": "SubagentStop",
        "agent_type": "" if agent_type is None else agent_type,
        "last_assistant_message": message,
    }
    return raw_hook(
        "post-agent-review-stamp.sh", payload, args=([role] if role else [])
    )


def gate():
    return "BLOCK" if '"block"' in hook("pre-bash-guard.sh", LAND) else "PASS"


def review():
    """One complete, well-formed review pass: dispatch → finish, twice, in order."""
    dispatch("code-reviewer")
    stop("finder")
    dispatch("review-verifier")
    stop("verifier")


def stamped():
    return (WORK / ".claude/.review-stamp").exists()


def finder_marked():
    return (WORK / ".claude/.finder-done").exists()


def paired():
    return (WORK / ".claude/.pair-ok").exists()


def clear_stamp():
    """Start a fresh review cycle through the real clear hook."""
    raw_hook(
        "pre-agent-review-clear.sh",
        {"tool_name": "Agent", "tool_input": {"subagent_type": "code-reviewer"}},
    )


def edit(rel_path, body):
    """Write a file the way the harness does: the write, then the per-edit hook.

    The hook is gated on file extension, so fixtures edited here are .ts.
    """
    pathlib.Path(rel_path).write_text(body)
    hook("post-edit-check.sh", str(WORK / rel_path))


def check(label, actual, expected):
    ok = actual == expected
    if not ok:
        failures.append(label)
    print(f"  {'ok  ' if ok else 'FAIL'} {label}: {actual} (expected {expected})")


def check_settings_wiring():
    """Confirm .claude/settings.json really wires the roles the cases below assume.

    Every case calls stop("finder") / stop("verifier") with the role hardcoded
    here, and none of it reads settings.json — so swapping the two arguments or
    typoing a matcher would leave this whole suite green and break only the live
    gate. That is the exact class of defect ADR-0022 exists to fix, discovered
    live rather than by a test, so it gets one.

    Scoped to the two matchers by name on purpose: asserting anything about entry
    count, ordering, or "no other entries" would break on unrelated future
    SubagentStop registrations, and the harness's semantics for overlapping
    matchers are not independently verified.
    """
    entries = json.loads((REPO / ".claude/settings.json").read_text())["hooks"].get(
        "SubagentStop", []
    )

    def command_for(matcher):
        for entry in entries:
            if entry.get("matcher") == matcher:
                for h in entry.get("hooks", []):
                    if "post-agent-review-stamp.sh" in h.get("command", ""):
                        return h["command"].strip()
        return None

    for matcher, role in (("code-reviewer", "finder"), ("review-verifier", "verifier")):
        cmd = command_for(matcher)
        check(
            f"settings.json wires {matcher} to the {role} role",
            cmd is not None and cmd.endswith(f" {role}"),
            True,
        )


def check_hooks_executable():
    """Every hook script settings.json registers must be executable.

    The harness invokes a registered hook by bare path, so a script without the
    executable bit simply does not run — the gate is silently off, which is the
    failure ADR-0013 exists to prevent. It happened: `pre-agent-review-pair.sh` was
    created 644 and could never write `.pair-ok`, so no commit could ever be
    stamped.

    This suite cannot catch it any other way, and in fact masks it: the cases above
    invoke hooks as `bash .claude/hooks/<name>`, which ignores the mode bits
    entirely. So the check reads the real settings file and the real files on disk.
    """
    settings = json.loads((REPO / ".claude/settings.json").read_text())
    missing = []
    for event_hooks in settings["hooks"].values():
        for entry in event_hooks:
            for h in entry.get("hooks", []):
                # Registered commands may carry arguments; the script is the first
                # token. Only project-local hooks are checked — an absolute path
                # elsewhere is not this repository's to police.
                script = h.get("command", "").split()[0]
                if "$CLAUDE_PROJECT_DIR/" not in script:
                    continue
                path = REPO / script.replace("$CLAUDE_PROJECT_DIR/", "")
                if not path.exists() or not os.access(path, os.X_OK):
                    missing.append(path.name)
    check("every registered hook script is executable", sorted(set(missing)), [])


sh("git init -q .")
sh("git config user.email test@example.com && git config user.name test")
pathlib.Path("fileA.ts").write_text("export const a = 1;\n")
sh("git add -A")
sh(f"{LAND} -qm init")

print("the real settings.json wires the roles this suite assumes")
check_settings_wiring()
check_hooks_executable()

print("a review is required before the first commit")
edit("fileA.ts", "export const a = 2;\n")
check("unreviewed diff", gate(), "BLOCK")
review()
check("reviewed diff", gate(), "PASS")

# The defect ADR-0022 fixes: the hook was registered on PostToolUse(Agent), which
# fires when the *launch* returns (`status: "async_launched"`), so dispatching two
# agents earned a stamp whether or not either produced a verdict. These cases pin
# the fix from both sides — the hook refuses a launch-shaped payload, and it
# refuses a finish that carries no report.
print("launching an agent is not finishing one (ADR-0022)")
clear_stamp()
edit("fileA.ts", "export const a = 4;\n")
launch_out = raw_hook(
    "post-agent-review-stamp.sh",
    {
        "hook_event_name": "PostToolUse",
        "tool_name": "Agent",
        "tool_input": {"subagent_type": "code-reviewer"},
    },
)
check("finder LAUNCH writes no finder marker", finder_marked(), False)
check("mis-registration is reported, not silent", "SubagentStop" in launch_out, True)
raw_hook(
    "post-agent-review-stamp.sh",
    {
        "hook_event_name": "PostToolUse",
        "tool_name": "Agent",
        "tool_input": {"subagent_type": "review-verifier"},
    },
)
check("verifier LAUNCH earns no stamp", gate(), "BLOCK")

# The role arrives as an argument from the matcher-scoped registration, NOT from
# the payload. A version of this fix branched on `agent_type`, and 20 of 23 real
# captured payloads carry `agent_type: ""` — so the field is not something to
# depend on even though both pinned agents do populate it.
print("the role comes from the registration argument, not the payload")
edit("fileA.ts", "export const a = 4;\n")
dispatch("code-reviewer")
stop("finder", agent_type="")
check("finder role with an empty agent_type still marks", finder_marked(), True)
dispatch("review-verifier")
stop("verifier", agent_type="")
check("verifier role with an empty agent_type still stamps", gate(), "PASS")

print("with no argument it falls back to agent_type")
edit("fileA.ts", "export const a = 5;\n")
dispatch("code-reviewer")
stop("", agent_type="code-reviewer")
check("fallback finder", finder_marked(), True)
dispatch("review-verifier")
stop("", agent_type="review-verifier")
check("fallback verifier", gate(), "PASS")

print("an unrecognised role does nothing")
edit("fileA.ts", "export const a = 6;\n")
dispatch("code-reviewer")
stop("finder")
dispatch("review-verifier")
stop("", agent_type="")
check("no role and no agent_type earns no stamp", gate(), "BLOCK")
check("...and leaves the cycle's markers untouched", finder_marked() and paired(), True)
stop("", agent_type="Explore")
check("an unrelated agent earns no stamp", gate(), "BLOCK")
stop("verifier")
check("the real verifier still stamps afterwards", gate(), "PASS")

print("a verifier alone cannot stamp (ADR-0015 pairing)")
edit("fileA.ts", "export const a = 7;\n")
clear_stamp()
sh("rm -f .claude/.finder-hash")  # as if no finder had ever completed
dispatch("review-verifier")
check("no finder dispatch means no pairing", paired(), False)
stop("verifier")
check("verifier with no finder", gate(), "BLOCK")

# The pairing invariant is decided at DISPATCH, not at completion (ADR-0022). It
# must catch the parent editing between the two dispatches — and must NOT be moved
# by the agents' own filesystem use during their runs, which is what an earlier
# completion-time version did, voiding passes where the parent changed nothing.
print("the parent editing between the two dispatches voids the cycle")
edit("fileA.ts", "export const a = 8;\n")
dispatch("code-reviewer")
stop("finder")
edit("fileA.ts", "export const a = 9;\n")  # the parent edits mid-window
pair_out = dispatch("review-verifier")
check("mid-window edit breaks the pairing", paired(), False)
check("and it is reported, not silent", "changed between" in pair_out, True)
stop("verifier")
check("so no stamp is earned", gate(), "BLOCK")
review()
check("a clean pass after it", gate(), "PASS")

# The pairing baseline is the tree at the finder's COMPLETION (ADR-0022), so
# neither agent's own execution is inside the compared window. Two earlier designs
# each included one and were voided by the agents' own scratch files. The second
# case below is the one that matters: an earlier version of this test removed the
# scratch file before the verifier's dispatch, which only proved the transient case
# and left the real one — residue surviving past the finder's own stop — untested.
print("an agent's filesystem use during its own run does NOT void the pass")
edit("fileA.ts", "export const a = 10;\n")
dispatch("code-reviewer")
# Both the create and the remove happen inside the finder's own run — i.e. before
# its SubagentStop, which is where the baseline is taken. Removing it *after* that
# stop would be a change in the parent's window and SHOULD void the pass; that
# direction is covered by the mid-window-edit case above.
pathlib.Path("agent-scratch.ts").write_text("export const scratch = 1;\n")
os.remove("agent-scratch.ts")
stop("finder")
dispatch("review-verifier")
check("transient churn leaves the pairing intact", paired(), True)
stop("verifier")
check("the pass still stamps", gate(), "PASS")

print("...including residue the finder never cleaned up")
edit("fileA.ts", "export const a = 11;\n")
dispatch("code-reviewer")
pathlib.Path("agent-leftover.ts").write_text("export const forgotten = 1;\n")
stop("finder")  # the finder stops WITHOUT removing its scratch file
dispatch("review-verifier")  # still present here — it is part of the baseline tree
check("leftover residue leaves the pairing intact", paired(), True)
stop("verifier")
check("the pass still stamps", gate(), "PASS")
os.remove("agent-leftover.ts")

print("fixing a finding does not require another review — the point of ADR-0019")
edit("fileA.ts", "export const a = 3;\n")
check("edit to a reviewed file", gate(), "PASS")
edit("helper.ts", "export const h = 1;\n")
check("fix that adds a file", gate(), "PASS")
os.remove("helper.ts")

print("an unrelated command that merely contains the word does not consume the stamp")
hook("post-bash-stamp-consume.sh", "git checkout -b feature/" + "com" + "mit-fix")
check("stamp survives a non-commit git command", stamped(), True)

print("one review covers a multi-commit split")
pathlib.Path("fileB.txt").write_text("B\n")
review()
sh("git add fileA.ts")
sh(f"{LAND} -qm part1")
hook("post-bash-stamp-consume.sh", LAND)
check("stamp survives a partial commit", stamped(), True)
check("second commit of the split", gate(), "PASS")

print("landing everything consumes the stamp")
sh("git add -A")
sh(f"{LAND} -qm part2")
check("tree clean", sh("git status --porcelain") == "", True)
hook("post-bash-stamp-consume.sh", LAND)
check("stamp consumed", stamped(), False)

print("the next task needs its own review")
pathlib.Path("fileC.txt").write_text("C\n")
check("unrelated unreviewed task", gate(), "BLOCK")

print()
if failures:
    print(f"FAILED: {len(failures)}")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print("all checks passed")
