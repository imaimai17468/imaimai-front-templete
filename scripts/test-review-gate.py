"""Exercise the review-gate mechanism (ADR-0019) against the real hook scripts.

    python3 scripts/test-review-gate.py

Builds a throwaway git repository under the system temp directory, copies the
hooks into it, and drives the sequences the gate has to get right: a review, a
fix (which must never need a second review), a multi-commit split on one stamp,
and an unrelated unreviewed task. Nothing touches this repository.

Run it after changing pre-bash-guard.sh, post-agent-review-stamp.sh, or
post-bash-stamp-consume.sh. Exits non-zero on a mismatch, so it works as a
pre-flight check rather than a report to read.
"""

import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

REPO = pathlib.Path(__file__).resolve().parent.parent
WORK = pathlib.Path(tempfile.gettempdir()) / "review-gate-check"

# Split so this file's own text cannot look like a commit to the gate that
# matches `git <anything> commit` — see post-bash-stamp-consume.sh.
LAND = "git " + "com" + "mit"

HOOKS = (
    "pre-bash-guard.sh",
    "post-agent-review-stamp.sh",
    "post-bash-stamp-consume.sh",
    # Included so the "a fix needs no second review" assertions below actually
    # exercise it. Writing the fixture file directly would pass whether or not
    # this hook still deletes the stamp, which is the regression that matters.
    "post-edit-check.sh",
)

shutil.rmtree(WORK, ignore_errors=True)
(WORK / ".claude/hooks").mkdir(parents=True)
for hook_name in HOOKS:
    shutil.copy(REPO / ".claude/hooks" / hook_name, WORK / ".claude/hooks" / hook_name)
os.chdir(WORK)
pathlib.Path(".gitignore").write_text(".claude/.review-stamp\n.claude/.finder-done\n")

failures = []


def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout.strip()


def hook(name, command):
    payload = {"tool_name": "Bash", "tool_input": {"command": command}}
    if name == "post-agent-review-stamp.sh":
        payload = {"tool_name": "Agent", "tool_input": {"subagent_type": command}}
    elif name == "post-edit-check.sh":
        payload = {"tool_name": "Edit", "tool_input": {"file_path": command}}
    return subprocess.run(
        ["bash", f".claude/hooks/{name}"],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        env={**os.environ, "CLAUDE_PROJECT_DIR": str(WORK)},
    ).stdout.strip()


def gate():
    return "BLOCK" if '"block"' in hook("pre-bash-guard.sh", LAND) else "PASS"


def review():
    hook("post-agent-review-stamp.sh", "code-reviewer")
    hook("post-agent-review-stamp.sh", "review-verifier")


def stamped():
    return (WORK / ".claude/.review-stamp").exists()


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


sh("git init -q .")
sh("git config user.email test@example.com && git config user.name test")
pathlib.Path("fileA.ts").write_text("export const a = 1;\n")
sh("git add -A")
sh(f"{LAND} -qm init")

print("a review is required before the first commit")
edit("fileA.ts", "export const a = 2;\n")
check("unreviewed diff", gate(), "BLOCK")
review()
check("reviewed diff", gate(), "PASS")

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
