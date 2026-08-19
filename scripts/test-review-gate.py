"""Exercise the review-gate mechanism (ADR-0019) against the real hook scripts.

    python3 scripts/test-review-gate.py

Builds a throwaway git repository under the system temp directory, copies the
hooks into it, and drives the sequences the gate has to get right: a review, a
fix (which must never need a second review), a multi-commit split on one stamp,
and an unrelated unreviewed task. It also pins the distinction ADR-0022 turns
on — launching a review agent is not finishing one — and, since ADR-0022's
residual gap was closed, what the review agent has to have said for its stop to
count. The section titled "a review that stopped without reporting has reviewed
nothing" is the authoritative statement of that; both outcomes it pins (refuse on
a blank message, stamp-with-a-warning when the field is absent) are asserted
there rather than described here. Nothing touches this repository, apart from
reading `.claude/settings.json` to confirm the real wiring.

The gate rests on two facts. That the `code-reviewer` agent finished having
reported something — the blank-message checks above carry that one. And that the
tree only holds files it reported on: the stamp lists every changed path, and a
commit touching a path that is not listed is refused. The sections "a fix to a
reviewed file keeps the stamp" and "a mid-run edit is recorded as reviewed" pin
the second fact and the hole it leaves.

Run it after changing any hook it drives — the `HOOKS` tuple below is the
authoritative list. Prose duplicating that list goes stale the next time a hook is
added, which already happened once. Exits non-zero on a mismatch, so it works as a
pre-flight check rather than a report to read.
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
    # The cycle-start clear (ADR-0009/0029). Driven as a real hook so a case fails
    # if it stops doing its job — writing the marker file directly would pass no
    # matter what it contains. `pre-agent-review-pair.sh` and `lib-review-hash.sh`
    # used to sit here too; ADR-0029 deleted both with the second dispatch.
    "pre-agent-review-clear.sh",
    # `post-edit-check.sh` used to be listed here, so that the "a fix needs no second
    # review" assertions ran through the hook that had once cleared the stamp on every
    # edit. ADR-0025 deleted that hook, so nothing runs on an edit any more and those
    # assertions now test what they always meant to: that a plain write does not
    # disturb the stamp. What no longer has a mechanism behind it is the guarantee
    # that some hook could not start clearing it again — see the comment on `edit()`.
    # Sourced by pre-bash-guard.sh and post-bash-stamp-consume.sh — the single
    # definition of "does this command land a commit". Without it, both abort.
    "lib-commit-shape.sh",
    # Sourced by post-agent-review-stamp.sh (to record which paths the review saw)
    # and by pre-bash-guard.sh (to compare the tree against that list). Without it
    # the writer refuses to stamp and the gate refuses to decide — both fail
    # closed, so omitting it here turns every stamped case into a BLOCK.
    "lib-review-scope.sh",
    # The SessionStart marker clear. It decides whether a stamp survives into the
    # next SessionStart, so it belongs here for the same reason the others do:
    # writing `.session-id` by hand would pass whatever the hook actually contains.
    "session-start-env-check.sh",
)

(WORK / ".claude/hooks").mkdir(parents=True)
for hook_name in HOOKS:
    shutil.copy(REPO / ".claude/hooks" / hook_name, WORK / ".claude/hooks" / hook_name)
os.chdir(WORK)
# Must match the real .gitignore's marker entries, which are per-name
# (`.claude/.review-stamp`, `.claude/.session-id`) rather than a wildcard. The gate
# reads the working tree's changed paths, and an un-ignored marker would appear
# among them — the stamp would then have to list itself. Keeping the list faithful
# to the real .gitignore is what makes "these are the markers" a fact rather than
# an approximation.
pathlib.Path(".gitignore").write_text(
    "\n".join(
        f".claude/{name}"
        for name in (
            ".review-stamp",
            # Written by session-start-env-check.sh.
            ".session-id",
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
    """Fire the PreToolUse(Agent) hook for a dispatch, as the harness does.

    It is registered on matcher `Agent` and filters on
    `tool_input.subagent_type`, so it is invoked for every dispatch and must react
    only to `code-reviewer` — the cases below dispatch other agent types to pin
    that.
    """
    payload = {"tool_name": "Agent", "tool_input": {"subagent_type": subagent_type}}
    return raw_hook("pre-agent-review-clear.sh", payload)


# Distinguishes "the payload carries no such key" from "the key is there and empty".
# The stamp hook treats those differently on purpose, so the harness has to be able to
# produce both — `None` cannot serve, because it is also a legitimate JSON null.
OMIT = object()


def stop(role="", agent_type=None, message="findings: none surviving"):
    """Fire post-agent-review-stamp.sh exactly as its registration does.

    `.claude/settings.json` registers it ONCE under `SubagentStop`, on matcher
    `code-reviewer`, passing no argument (ADR-0029). `role` is still a parameter
    because the hook must tolerate one: a settings file the harness has not
    re-read still passes `finder` or `verifier`, and under the ADR-0022 script
    `finder` meant "record a baseline, do not stamp" — which would wedge every
    commit in such a session. The cases below pin all three invocations behaving
    identically.

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
    """One complete, well-formed review pass: dispatch → finish (ADR-0029)."""
    dispatch("code-reviewer")
    stop()


def stamped():
    return (WORK / ".claude/.review-stamp").exists()


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

    A plain write, because no hook fires on an edit — ADR-0025 deleted the only
    `PostToolUse(Edit|Write|MultiEdit)` registration. That makes this helper an
    honest model of an edit today. Nothing needs to fire: what the gate reads is
    the set of changed paths, which git reports whether or not a hook watched the
    write. If a hook that reacts to edits is ever added, add it to `HOOKS` and
    drive it from here. Fixtures stay
    `.ts` so the Stop gate's code-relevant branch sees them.
    """
    pathlib.Path(rel_path).write_text(body)


def check(label, actual, expected):
    ok = actual == expected
    if not ok:
        failures.append(label)
    print(f"  {'ok  ' if ok else 'FAIL'} {label}: {actual} (expected {expected})")


def check_settings_wiring():
    """Confirm .claude/settings.json really wires the stamp the cases below assume.

    None of the cases read settings.json, so a typoed matcher would leave this
    whole suite green and break only the live gate. That is the exact class of
    defect ADR-0022 exists to fix, discovered live rather than by a test, so it
    gets one.

    Scoped to the matcher by name on purpose: asserting anything about entry
    count, ordering, or "no other entries" would break on unrelated future
    SubagentStop registrations, and the harness's semantics for overlapping
    matchers are not independently verified.

    What is asserted about the argument is only that the shipped registration
    passes none (ADR-0029). The hook must still *tolerate* `finder` and
    `verifier`, because a harness that has not re-read this file keeps sending
    them — that tolerance is pinned by the cases below, not here.
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

    cmd = command_for("code-reviewer")
    check("settings.json stamps on code-reviewer", cmd is not None, True)
    check(
        "...and passes no role argument",
        cmd is not None and cmd.endswith("post-agent-review-stamp.sh"),
        True,
    )
    check(
        "no review-verifier matcher survives",
        command_for("review-verifier") is None,
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
# This machine signs commits by default (`commit.gpgsign=true` globally). A
# fixture commit that waits on pinentry made this suite flaky and occasionally
# hung it for minutes — misread once as CPU contention. Repo-local, so it covers
# every commit the cases below run.
sh("git config commit.gpgsign false")
pathlib.Path("fileA.ts").write_text("export const a = 1;\n")
sh("git add -A")
sh(f"{LAND} -qm init")

print("the real settings.json wires the stamp this suite assumes")
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
check("a LAUNCH-shaped payload earns no stamp", gate(), "BLOCK")
check("mis-registration is reported, not silent", "SubagentStop" in launch_out, True)

# ADR-0029 removed the role branch: the shipped registration passes no argument,
# but a harness that has not re-read settings.json keeps sending the ADR-0022 ones.
# Under the old script `finder` meant "record a baseline, do not stamp", so a
# cached registration would have wedged every commit in that session. All three
# invocations must therefore behave identically.
print("the invocation argument does not change the outcome (ADR-0029)")
for arg, label in (("", "no argument"), ("finder", "a stale `finder`"), ("verifier", "a stale `verifier`")):
    clear_stamp()
    edit("fileA.ts", f"export const a = 4{len(label)};\n")
    check(f"{label} still stamps", (stop(arg), gate())[1], "PASS")

# `agent_type` is not consulted at all — the SubagentStop matcher is what selects
# the agent. 20 of 23 real captured payloads carry `agent_type: ""`, so a script
# branching on it would refuse most legitimate stops.
print("agent_type is not what selects the stamp")
clear_stamp()
edit("fileA.ts", "export const a = 5;\n")
stop("", agent_type="")
check("an empty agent_type still stamps", gate(), "PASS")

# The residual gap ADR-0029 accepted, pinned so it is a recorded property rather
# than an undocumented surprise. With one dispatch there is no window to hash, so
# an edit landing while the agent runs is invisible to the gate. The two-agent
# pairing check caught exactly this and went away with the second dispatch.
# The stamp is written at SubagentStop, so a path first touched DURING the run is
# recorded as reviewed. This is the hole the scope does not close, and it is
# pinned rather than left undescribed.
print("a mid-run edit is recorded as reviewed (the residual gap)")
clear_stamp()
edit("fileA.ts", "export const a = 6;\n")
dispatch("code-reviewer")
edit("fileA.ts", "export const a = 7;\n")  # the parent edits while the agent runs
stop()
check("a mid-run edit does NOT block the commit", gate(), "PASS")

# The property the design exists for: editing a file the review already read is
# what applying a finding's fix looks like, and it keeps the stamp. A path the
# review never saw does not.
print("a fix to a reviewed file keeps the stamp")
clear_stamp()
edit("fileA.ts", "export const a = 8;\n")
review()
check("the reviewed tree commits", gate(), "PASS")
edit("fileA.ts", "export const a = 9;\n")
check("re-editing a reviewed file still commits", gate(), "PASS")
edit("fileB.ts", "export const b = 1;\n")
check("a file the review never saw blocks", gate(), "BLOCK")
os.remove("fileB.ts")
check("removing it restores the covered scope", gate(), "PASS")

print("without the scope library the writer records nothing")
# The writer sources lib-review-scope.sh from its own directory. Untested,
# that fail-closed branch is the same shape as the 644-permission incident: a gate
# that quietly stops deciding. Hiding the copy in WORK models the file being
# absent without touching the real hooks directory.
clear_stamp()
edit("fileA.ts", "export const a = 11;\n")
dispatch("code-reviewer")
_lib = pathlib.Path(".claude/hooks/lib-review-scope.sh")
_hidden = pathlib.Path(".claude/hooks/lib-review-scope.hidden")
_lib.rename(_hidden)
try:
    out = stop()
    check("no stamp is written", stamped(), False)
    check("...and it says which file is missing", "lib-review-scope.sh" in out, True)
finally:
    _hidden.rename(_lib)
review()
check("restoring the library lets a review stamp again", gate(), "PASS")

# The cycle-start clear must react to `code-reviewer` and to nothing else, or an
# Explore scout dispatched after a review would silently discard the stamp.
print("only a code-reviewer dispatch starts a new cycle")
review()
check("stamped before the unrelated dispatch", gate(), "PASS")
dispatch("Explore")
check("an Explore dispatch leaves the stamp alone", gate(), "PASS")
dispatch("code-reviewer")
check("a code-reviewer dispatch clears it", gate(), "BLOCK")
stop()
check("and the completion re-earns it", gate(), "PASS")

# An agent's own scratch files used to matter enormously: two ADR-0022 designs
# hashed a window containing one agent's run and were voided by files that agent
# created itself. Nothing hashes anything now (ADR-0029), so the case is kept only
# to pin that the churn is genuinely inert rather than merely believed to be.
print("an agent's filesystem use during its own run is inert")
clear_stamp()
edit("fileA.ts", "export const a = 10;\n")
dispatch("code-reviewer")
pathlib.Path("agent-leftover.ts").write_text("export const forgotten = 1;\n")
stop()  # the agent stops WITHOUT removing its scratch file
check("leftover residue does not prevent the stamp", gate(), "PASS")
os.remove("agent-leftover.ts")

print("a review that stopped without reporting has reviewed nothing")
# The gap ADR-0022 recorded and deferred, and which then fired for real: on
# 2026-07-30 a review agent died on an API 529 mid-run, and the marker files alone
# stamped the gate. Since ADR-0029 this check is the ENTIRE gate — the two marker
# facts that used to stand beside it are gone — so each case below is the only
# thing between a dead dispatch and an authorised commit.
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
    out = stop(message=msg)
    check(label, stamped(), want_stamp)
    if msg is OMIT:
        check("...and says the check was skipped", "could not be checked" in out, True)
    elif not want_stamp:
        check("...and says why it refused", "NOT written" in out, True)
    # Leave no stamp behind for the next case: without this, a case that must NOT
    # stamp would inherit the previous case's stamp and pass for the wrong reason.
    clear_stamp()


def cursor_stop(status="completed", summary=OMIT, loop_count=0):
    """Fire the stamp hook with a Cursor-shaped subagentStop payload.

    Shape taken from two payloads captured live on 2026-08-07 in a Cursor cloud
    agent session running this repository's real hooks: camelCase
    `hook_event_name`, `subagent_type`, `status` (completed | error | aborted),
    `loop_count`, and — when the harness supplies the agent's report — `summary`.
    Neither carried `last_assistant_message`; an earlier desktop capture the
    same day carried neither report field at all, which is the `summary=OMIT`
    case below.
    """
    payload = {
        "hook_event_name": "subagentStop",
        "subagent_type": "code-reviewer",
        "status": status,
        "loop_count": loop_count,
    }
    if summary is not OMIT:
        payload["summary"] = summary
    return raw_hook("post-agent-review-stamp.sh", payload)


# The refusals above are visible in Claude Code through systemMessage, which
# Cursor ignores — a blank-report refusal there used to be silent until the
# commit gate fired later with no stated cause (2026-08-07, ending with an agent
# asking the user to hand-create the marker). The hook now rides the refusal on
# followup_message, the one documented subagentStop output Cursor consumes, and
# only on the first loop (Claude-registered hooks run in Cursor with no followup
# cap). These cases pin the emission side; whether Cursor consumes it from this
# hook is not testable here.
print("the Cursor dialect stamps and refuses like the Claude one")
for label, kwargs, want_stamp, want_followup in (
    ("a completed stop with a summary stamps",
     dict(summary="findings: none surviving"), True, False),
    ("an aborted stop does not stamp",
     dict(status="aborted", summary="partial text"), False, False),
    ("an errored stop does not stamp",
     dict(status="error", summary="partial text"), False, False),
    ("a blank summary does not stamp, and the refusal rides a followup",
     dict(summary=""), False, True),
    ("a null summary does not stamp, and the refusal rides a followup",
     dict(summary=None), False, True),
    ("no followup after the first loop",
     dict(summary="", loop_count=1), False, False),
):
    edit("fileA.ts", f"export const a = {len(label)};\n")
    dispatch("code-reviewer")
    out = cursor_stop(**kwargs)
    check(label, stamped(), want_stamp)
    check(
        f"...followup {'present' if want_followup else 'absent'}",
        "followup_message" in out,
        want_followup,
    )
    clear_stamp()

# The desktop capture that carried neither report field: nothing to judge, so it
# stamps and says the check was skipped — same contract as the Claude OMIT case.
edit("fileA.ts", "export const a = 901;\n")
dispatch("code-reviewer")
out = cursor_stop()
check("neither report field stamps, with a warning", stamped(), True)
check("...and says the check was skipped", "could not be checked" in out, True)
clear_stamp()

# The followup stays scoped to the camelCase dialect: what Claude Code does with
# an unknown followup_message field has not been observed, so its payloads must
# keep producing exactly the pre-change output.
edit("fileA.ts", "export const a = 902;\n")
dispatch("code-reviewer")
out = stop(message="")
check("a Claude-dialect blank refusal carries no followup",
      "followup_message" in out, False)
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

# Mid-cycle: a SessionStart landing between the dispatch and the completion must
# not stop the pass from stamping. Since ADR-0029 there is one marker and it does
# not exist yet at that point, so what this pins is that the clear leaves nothing
# behind that the completion then trips over.
dispatch("code-reviewer")
check("mid-cycle: no stamp yet", stamped(), False)
session_start("session-BBB")
stop()
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
