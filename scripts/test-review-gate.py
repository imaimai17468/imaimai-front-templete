"""Exercise the review-gate mechanism (ADR-0019) against the real hook scripts.

    python3 scripts/test-review-gate.py

Builds a throwaway git repository under the system temp directory, copies the
hooks into it, and drives the sequences the gate has to get right: a review, a
fix (which must never need a second review), a multi-commit split on one stamp,
and an unrelated unreviewed task. It also pins the distinction ADR-0022 turns
on — launching a review agent is not finishing one — and, since ADR-0022's
residual gap was closed, what a verifier has to have said for its stop to count.
The section titled "a verifier that stopped without reporting has verified
nothing" is the authoritative statement of that; both outcomes it pins (refuse on
a blank message, stamp-with-a-warning when the field is absent) are asserted
there rather than described here. Nothing touches this repository, apart from
reading `.claude/settings.json` to confirm the real wiring.

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
    # `post-edit-check.sh` used to be listed here, so that the "a fix needs no second
    # review" assertions ran through the hook that had once cleared the stamp on every
    # edit. ADR-0025 deleted that hook, so nothing runs on an edit any more and those
    # assertions now test what they always meant to: that a plain write does not
    # disturb the stamp. What no longer has a mechanism behind it is the guarantee
    # that some hook could not start clearing it again — see the comment on `edit()`.
    # Sourced by the two pre-agent hooks; without it they abort.
    "lib-review-hash.sh",
    # Sourced by pre-bash-guard.sh and post-bash-stamp-consume.sh — the single
    # definition of "does this command land a commit". Without it, both abort.
    "lib-commit-shape.sh",
    # The SessionStart marker clear. It decides whether a stamp survives into the
    # next SessionStart, so it belongs here for the same reason the others do:
    # writing `.session-id` by hand would pass whatever the hook actually contains.
    "session-start-env-check.sh",
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
            # Written by session-start-env-check.sh. Un-ignored it would enter the
            # hash, and the SessionStart cases below would break the very pairing
            # they then assert on.
            ".session-id",
            # No case exercises these two, so they are here to keep the claim above
            # literally true rather than approximately: the list is the real
            # .gitignore's `.claude/.*` entries, or it is a claim that drifts.
            ".aegis-stamp",
            ".aegis-unavailable",
        )
    )
    + "\n"
)

failures = []


def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout.strip()


def hook(name, command):
    payload = {"tool_name": "Bash", "tool_input": {"command": command}}
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


# Distinguishes "the payload carries no such key" from "the key is there and empty".
# The stamp hook treats those differently on purpose, so the harness has to be able to
# produce both — `None` cannot serve, because it is also a legitimate JSON null.
OMIT = object()


def stop(role, agent_type=None, message="findings: none surviving"):
    """Fire post-agent-review-stamp.sh exactly as its registration does.

    `.claude/settings.json` registers it twice under `SubagentStop`, once per
    matcher, passing `finder` or `verifier` as an argument — the role does NOT come
    from the payload. That indirection exists because 20 of 23 captured payloads
    carried `agent_type: ""` (ADR-0022). Pass `role=""` to exercise the
    argument-less fallback that still reads `agent_type`.

    `message=OMIT` drops `last_assistant_message` entirely, modelling a harness that
    does not supply it.
    """
    payload = {
        "hook_event_name": "SubagentStop",
        "agent_type": "" if agent_type is None else agent_type,
    }
    if message is not OMIT:
        payload["last_assistant_message"] = message
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


def session_id_file():
    """The remembered session id, or None when the hook dropped it.

    Asserted directly because this file IS the mechanism: every other SessionStart
    assertion below is downstream of whether it holds the right value.
    """
    path = WORK / ".claude/.session-id"
    return path.read_text() if path.exists() else None


def session_start(session_id=None, source=None):
    """Fire the SessionStart env-check with an optional `session_id` / `source`.

    The clear is conditional on session identity, and `source` overrides it: a
    SessionStart re-firing for the session already running must not discard
    markers that session earned, but `clear` / `fork` begin a different body of
    work regardless of the id (`resume` is deliberately excluded — see the cases
    below and ADR-0028). Pass None for either to drive
    the fail-safe branches — an absent field must never mean "keep", so a payload
    shape this repository has not observed can never leave a stamp standing.
    """
    payload = {"hook_event_name": "SessionStart"}
    if session_id is not None:
        payload["session_id"] = session_id
    if source is not None:
        payload["source"] = source
    return raw_hook("session-start-env-check.sh", payload)


def edit(rel_path, body):
    """Write a file the way the harness does.

    A plain write, because no hook fires on an edit any more — ADR-0025 deleted the
    only `PostToolUse(Edit|Write|MultiEdit)` registration. That makes this helper an
    honest model of an edit today, and it also means this suite can no longer catch a
    future hook that starts clearing `.review-stamp` on every edit (the ADR-0013
    behaviour ADR-0019 removed). If such a hook is ever added, add it to `HOOKS` and
    drive it from here, or the "a fix needs no second review" assertions below go back
    to passing for the wrong reason. Fixtures stay `.ts` so the Stop gate's
    code-relevant branch sees them.
    """
    pathlib.Path(rel_path).write_text(body)


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

print("a verifier that stopped without reporting has verified nothing")
# The gap ADR-0022 recorded and deferred, and which then fired for real: on
# 2026-07-30 a review-verifier died on an API 529 mid-run, and the two marker files
# alone stamped the gate. Both marker facts hold in every case below — the only
# variable is what the agent said.
for label, msg, want_stamp in (
    ("a real verdict stamps", "CONFIRMED: 2 findings survive", True),
    ("an empty message does not", "", False),
    ("whitespace only does not", "   \n\t  ", False),
    ("a JSON null does not", None, False),
    # A harness that omits the field entirely cannot be judged. Stamping there is
    # deliberate: refusing would wedge every commit on a platform change, which is
    # the risk that kept this check out of the hook until now.
    ("an absent field stamps, with a warning", OMIT, True),
):
    edit("fileA.ts", f"export const a = {len(label)};\n")
    dispatch("code-reviewer")
    stop("finder")
    dispatch("review-verifier")
    out = stop("verifier", message=msg)
    check(label, stamped(), want_stamp)
    if msg is OMIT:
        check("...and says the check was skipped", "could not be checked" in out, True)
    elif not want_stamp:
        check("...and says why it refused", "NOT written" in out, True)
    # Leave no stamp behind for the next case: without this, a case that must NOT
    # stamp would inherit the previous case's stamp and pass for the wrong reason.
    clear_stamp()

# Restore the invariant the following sections run on — a stamp earned by a clean
# pass. The loop above deliberately ends with none, and the next section asserts that
# editing a reviewed file still passes the gate, which needs one.
review()
check("a clean pass re-establishes the stamp", gate(), "PASS")

print("an unrelated command that merely contains the word does not consume the stamp")
hook("post-bash-stamp-consume.sh", "git checkout -b feature/" + "com" + "mit-fix")
check("stamp survives a non-commit git command", stamped(), True)
hook("post-bash-stamp-consume.sh", "git log --grep=" + "com" + "mit")
check("stamp survives a log search for the word", stamped(), True)
# Over-consuming deletes a stamp the review legitimately earned, so the consume side
# cuts at the first heredoc operator. Prose in a heredoc body was enough to trigger
# it, and writing a document through a heredoc is routine here.
hook("post-bash-stamp-consume.sh",
     "cat <<'EOF' > notes.md\nrun " + LAND + " when ready\nEOF")
check("stamp survives prose inside a heredoc body", stamped(), True)
hook("post-bash-stamp-consume.sh", "echo 'please run " + LAND + " later'")
check("stamp survives prose in a quoted echo", stamped(), True)

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

# Verified holes, 2026-07-30. The gate and this hook carried separate regexes that
# had drifted: an operator glued directly after `commit` (no whitespace) meant a
# real landed commit was NOT recognised here, so the stamp outlived its reviewed
# batch and could authorise the next, unreviewed change — the hole this hook exists
# to close. And a shell metacharacter glued directly BEFORE `git` escaped the gate
# entirely, needing no stamp at all. Both now go through lib-commit-shape.sh.
print("every shape that lands a commit is recognised on the way out")
for shape in (LAND, f"{LAND};true", f"{LAND}&&true", f"{LAND}|cat", f"({LAND})",
              f"$({LAND})", f"`{LAND}`", f"git add -A && {LAND} -m x",
              # bash resolves these before dispatch, so each really commits
              f"git '{LAND.split()[1]}' -m x", "git${IFS}" + LAND.split()[1],
              "git co\\\nmm\\\nit -m x",
              # a real commit written with a heredoc: the verb precedes the operator,
              # so truncating at `<<` must not hide it
              f"{LAND} -F - <<'MSG'\nsubject\nMSG"):
    pathlib.Path("fileC.ts").write_text(f"export const c = {len(shape)};\n")
    review()
    sh("git add -A")
    sh(f"{LAND} -qm shape")
    hook("post-bash-stamp-consume.sh", shape)
    check(f"consumed after {shape!r}", stamped(), False)

# The mirror-image hole — a metacharacter glued directly before `git` escaping the
# gate entirely — is pinned in scripts/test-bash-guard.py, which is the suite
# pre-bash-guard.sh's own header points at. Both sides now resolve the shape through
# lib-commit-shape.sh, so they cannot disagree again.

print("the next task needs its own review")
pathlib.Path("fileC.txt").write_text("C\n")
check("unrelated unreviewed task", gate(), "BLOCK")

print("a SessionStart clears the stamp only when the session actually changed")
review()
check("stamped before any SessionStart", stamped(), True)
session_start("session-AAA")
check("first SessionStart (unseen id) clears", stamped(), False)

check("id recorded on the clearing branch", session_id_file(), "session-AAA")

review()
session_start("session-AAA")
check("same id re-firing keeps the stamp", stamped(), True)
session_start("session-BBB")
check("a different id clears", stamped(), False)
check("id updated to the new session", session_id_file(), "session-BBB")

# Mid-cycle, which is where a future edit splitting the clear block would show:
# after a completed review only `.review-stamp` is left, because the verifier's
# stop consumes the pairing markers (ADR-0022). Between the finder finishing and
# the verifier being dispatched they are still on disk, so this is the only point
# at which "keeps them as one block" is observable at all.
dispatch("code-reviewer")
stop("finder")
check("mid-cycle: the finder marker is on disk", finder_marked(), True)
session_start("session-BBB")
check("same id re-firing keeps the finder marker", finder_marked(), True)
dispatch("review-verifier")
stop("verifier")
# And the pairing still holds across it — a SessionStart writes only `.session-id`,
# which is ignored, so an in-flight review is not voided by one.
check("a SessionStart mid-cycle does not void the pass", stamped(), True)

review()
session_start(None)
check("payload without session_id clears (fail-safe)", stamped(), False)
# The memory is dropped too, so the next SessionStart cannot match a stale id.
check("id forgotten when the payload carries none", session_id_file(), None)

print("a matching id does not save a stamp when `source` starts new work")
# Each case first records the id, then earns a stamp, then re-fires with the SAME
# id — the keep-branch's exact precondition — so the only thing under test is
# whether `source` overrides it (ADR-0028).
for i, new_work in enumerate(("clear", "fork")):
    sid = f"session-new-{i}"
    session_start(sid, source="startup")
    review()
    session_start(sid, source=new_work)
    check(f"id matches but source={new_work} still clears", stamped(), False)

# `resume` is the one that looks like it belongs above and does not: it fires
# inside continuous work here, so forcing a clear on it costs a whole pass. This
# case is the guard against putting it back (ADR-0028).
for i, same_work in enumerate(("compact", "startup", "resume")):
    sid = f"session-same-{i}"
    session_start(sid, source="startup")
    review()
    session_start(sid, source=same_work)
    check(f"id matches and source={same_work} keeps", stamped(), True)

# An unrecognised source must fall back to the id check, never to "keep".
session_start("session-unknown", source="something-unheard-of")
review()
session_start("session-different", source="something-unheard-of")
check("an unknown source with a new id still clears", stamped(), False)
review()
session_start("session-different", source="something-unheard-of")
check("an unknown source falls back to the id check", stamped(), True)

# A `source` that is not a string at all. Two cases, not one: `jq`'s `// empty`
# folds JSON null into absence, while a number survives as a raw string and then
# fails the `case` — different paths through the same expression. `session_start`
# cannot express either (its `source=None` omits the field, the way this file's
# own OMIT sentinel exists to distinguish elsewhere), so these go through
# `raw_hook`. Both must land on the id check, never on "keep" by default.
for label, bad_source in (("null", None), ("42", 42)):
    sid = f"session-{label}-source"
    session_start(sid, source="startup")
    review()
    raw_hook(
        "session-start-env-check.sh",
        {"hook_event_name": "SessionStart", "session_id": sid, "source": bad_source},
    )
    check(f"source: {label} falls back to the id check", stamped(), True)

print()
if failures:
    print(f"FAILED: {len(failures)}")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print("all checks passed")
