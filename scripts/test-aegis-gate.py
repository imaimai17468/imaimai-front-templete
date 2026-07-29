"""Exercise the Aegis dispatch gate (ADR-0013) against the real hook scripts.

    python3 scripts/test-aegis-gate.py

Builds a throwaway project directory under the system temp directory, copies the
hooks into it, and drives the sequences the gate has to get right: a successful
consultation stamps, a failed one does not, a user prompt clears the stamp, and
`Agent` dispatch is admitted or blocked accordingly. Nothing touches this
repository.

Run it after changing post-aegis-compile.sh, user-prompt-gate.sh, or
pre-agent-aegis-guard.sh. Exits non-zero on a mismatch, so it works as a
pre-flight check rather than a report to read.

Why this file exists. Between 4ff5e81 and 2026-07-29 the stamp was never created
on macOS: `shopt -s extglob globstar nullglob` sat above the `touch`, bash 3.2
has no `globstar`, and `set -e` aborted the hook there. Every non-exempt dispatch
was blocked for weeks, and it stayed invisible because the four pinned review
agents are exempt in pre-agent-aegis-guard.sh — so the review pipeline, the part
anyone would notice, kept working. That is ADR-0013's own audit finding 3 (gates
degrading silently per machine) happening again to the gate the ADR introduced.

The dynamic checks below only catch it on a shell that lacks the construct, so
they would pass on a bash-4 container while the developer's Mac stayed broken.
The static invariant is the part that generalizes: nothing in a gate hook may use
a construct that aborts on the oldest shell the project runs on.
"""

import atexit
import json
import os
import pathlib
import re
import shlex
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
_WORK_TMP = tempfile.TemporaryDirectory(prefix="aegis-gate-check-")
atexit.register(_WORK_TMP.cleanup)
WORK = pathlib.Path(_WORK_TMP.name)

HOOKS = (
    "post-aegis-compile.sh",
    "user-prompt-gate.sh",
    "pre-agent-aegis-guard.sh",
)

COMPILE_TOOL = "mcp__aegis__aegis_compile_context"

(WORK / ".claude/hooks").mkdir(parents=True)
for hook_name in HOOKS:
    shutil.copy(REPO / ".claude/hooks" / hook_name, WORK / ".claude/hooks" / hook_name)
os.chdir(WORK)

failures = []
STAMP = WORK / ".claude/.aegis-stamp"
UNAVAILABLE = WORK / ".claude/.aegis-unavailable"


def executable_part(line):
    """`line` with any trailing comment removed, approximating shell word rules.

    Hand-rolled cuts kept missing a variant: first a literal space before `#`,
    then a tab, then `;#` with no whitespace at all — each one let a comment
    supply the `|| true` the check looks for, which fails open. `shlex`
    generalizes across separators and understands quoting, so a `#` inside a
    quoted argument is no longer mistaken for a comment.

    It is stricter than bash, deliberately left so: bash opens a comment only on
    a `#` that begins a word, while `shlex` opens one on any unquoted `#`,
    including mid-word — `globstar#opt` is a single invalid option name to bash,
    not `globstar` followed by a comment. That can only strip more than bash
    would, so the check may fail on a line bash accepts and can never miss a
    guard that is not there.
    """
    lex = shlex.shlex(line, posix=False, punctuation_chars=True)
    lex.whitespace_split = True
    try:
        return " ".join(lex)
    except ValueError:
        # Unbalanced quote: shlex cannot tokenize it. Returning the raw line
        # would keep whatever `|| true` sits after the broken quote and mark the
        # line guarded on that alone — fail-open. Return nothing instead, so an
        # unparseable line is always flagged.
        return ""


def check(label, actual, expected):
    ok = actual == expected
    if not ok:
        failures.append(label)
    print(f"  {'ok  ' if ok else 'FAIL'} {label}: {actual} (expected {expected})")


def hook(name, payload):
    return subprocess.run(
        ["bash", f".claude/hooks/{name}"],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        env={**os.environ, "CLAUDE_PROJECT_DIR": str(WORK)},
    )


def compile_hook(tool_response, target_files=(".claude/rules/authoring.md",)):
    """Drive PostToolUse for a compile_context call. `tool_response=None` omits it."""
    payload = {
        "tool_name": COMPILE_TOOL,
        "tool_input": {"target_files": list(target_files)},
    }
    if tool_response is not None:
        payload["tool_response"] = tool_response
    return hook("post-aegis-compile.sh", payload)


def dispatch(subagent_type="general-purpose", transcript=None):
    payload = {"tool_name": "Agent", "tool_input": {"subagent_type": subagent_type}}
    if transcript is not None:
        payload["transcript_path"] = str(transcript)
    return "BLOCK" if '"block"' in hook("pre-agent-aegis-guard.sh", payload).stdout else "PASS"


def stamped():
    return STAMP.exists()


def clear():
    STAMP.unlink(missing_ok=True)
    UNAVAILABLE.unlink(missing_ok=True)


print(f"shell under test: {subprocess.run(['bash', '--version'], capture_output=True, text=True).stdout.splitlines()[0]}")
print()

print("no gate hook may use a construct that aborts on bash 3.2")
# Every hook this file drives, not just the one that broke: the invariant is about
# the gate, and a bash-4-only construct reintroduced into any of them fails the
# same way.
#
# `shopt -s <name>` exits non-zero on an unknown option, which `set -e` turns into
# an abort. Guarding each one keeps a newer option optional rather than required.
# `mapfile` / `readarray` / `declare -A` do not exist in 3.2 at all.
#
# Both are read with whole-line comments stripped — naming a construct in a comment
# to explain why it is avoided is exactly what these hooks should do, and the first
# version of this check failed on its own explanatory comment. The guard test then
# lexes each `shopt` line (see `executable_part`); the builtin test is a substring
# match. Neither is a shell parser: they catch the construct written plainly, which
# is how it gets reintroduced by accident, and they do not survive indirection
# (`command shopt …`, `eval "shopt …"`, a builtin name assembled from a variable).
# That is the intended strength — this guards against a careless edit, not against
# someone working around it.
#
# One gap is known and left as a gap, because it fails closed — it can fail the
# test on a harmless line, never pass an aborting one. The builtin check matches
# against the whole per-hook text rather than line by line, so a trailing comment
# naming `mapfile` / `readarray` / `declare -A` would fail it even though no such
# builtin is called.
for hook_name in HOOKS:
    code = "\n".join(
        line
        for line in (REPO / ".claude/hooks" / hook_name).read_text().splitlines()
        if not line.lstrip().startswith("#")
    )
    # The guard has to be executable, so a comment must not be able to supply it:
    # `shopt -s globstar # || true` aborts on 3.2 exactly like the unguarded form.
    unguarded = [
        line.strip()
        for line in code.splitlines()
        if re.match(r"\s*shopt\s", line) and "|| true" not in executable_part(line)
    ]
    check(f"no unguarded shopt: {hook_name}", unguarded, [])
    check(
        f"no bash-4-only builtins: {hook_name}",
        sorted({w for w in ("mapfile", "readarray", "declare -A") if w in code}),
        [],
    )

print("a successful consultation stamps the gate")
clear()
run = compile_hook({"isError": False})
check("object-shaped response: exit", run.returncode, 0)
check("object-shaped response: stamp", stamped(), True)
clear()
compile_hook([{"type": "text", "text": "{}"}])
check("array-shaped response (MCP delivery)", stamped(), True)
clear()
compile_hook({"isError": False}, target_files=())
check("empty target_files still stamps", stamped(), True)
clear()
# An empty-string entry is what separates the read loop from the `mapfile -t` it
# replaces: the builtin keeps it as an element, and a blank-line filter would
# not. It also puts an empty element into the array the near-miss loop expands
# under `set -u`, which is where bash 3.2 would object if it were going to.
empty_entry = compile_hook({"isError": False}, target_files=("",))
check("empty-string target_file: exit", empty_entry.returncode, 0)
check("empty-string target_file: stderr", empty_entry.stderr.strip(), "")
check("empty-string target_file: stamp", stamped(), True)

print("a consultation that did not succeed must not stamp — fail closed")
for label, response in (
    ("isError true", {"isError": True}),
    ("is_error true", {"is_error": True}),
    ("no tool_response", None),
    ("bare string response", "boom"),
):
    clear()
    compile_hook(response)
    check(label, stamped(), False)

print("the stamp is per-prompt: a user prompt clears it")
clear()
compile_hook({"isError": False})
hook("user-prompt-gate.sh", {"prompt": "next task"})
check("cleared on UserPromptSubmit", stamped(), False)

print("dispatch is admitted only with a stamp")
clear()
check("no stamp", dispatch(), "BLOCK")
compile_hook({"isError": False})
check("with stamp", dispatch(), "PASS")

print("exemptions and the auditable degrade")
clear()
for exempt in ("Explore", "code-reviewer", "review-verifier", "spec-verifier", "spec-checker"):
    check(f"{exempt} without a stamp", dispatch(exempt), "PASS")
UNAVAILABLE.write_text("aegis MCP tools absent in this session\n")
check("general-purpose under .aegis-unavailable", dispatch(), "PASS")
clear()

print("a subagent's own dispatch is not the parent's gate")
transcript = WORK / "sidechain.jsonl"
transcript.write_text('{"isSidechain":true}\n')
check("sidechain dispatch", dispatch(transcript=transcript), "PASS")

print("the near-miss warning fires only on an Aegis/shell glob divergence")
clear()
suspicious = compile_hook(
    {
        "isError": False,
        "debug_info": {
            "near_miss_edges": [
                {
                    "reason": "glob_no_match",
                    "pattern": "src/gateways/*/index.ts",
                    "target_doc_id": "adr-0016",
                },
                {"reason": "command_mismatch", "pattern": "x", "target_doc_id": "adr-0001"},
            ]
        },
    },
    target_files=("src/gateways/user/index.ts",),
)
check("shell matches what Aegis missed: warns", "near_miss_edges warning" in suspicious.stdout, True)
check("command_mismatch is not reported", "adr-0001" in suspicious.stdout, False)
clear()
routine = compile_hook(
    {
        "isError": False,
        "debug_info": {
            "near_miss_edges": [
                {"reason": "glob_no_match", "pattern": "docs/adr/*.md", "target_doc_id": "adr-0016"}
            ]
        },
    },
    target_files=("src/routes/x.tsx",),
)
check("shell agrees it does not match: silent", routine.stdout.strip(), "")

print()
if failures:
    print(f"FAILED: {len(failures)}")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print("all checks passed")
