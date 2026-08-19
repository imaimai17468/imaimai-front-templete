#!/usr/bin/env python3
"""Pins `review_scope`, the function the commit gate decides on.

The gate refuses a commit that touches a path the review stamp does not list. That
is only as strong as this function: a path it mis-reads, or a failure it reports as
"nothing changed", is a commit that lands unreviewed.

Driven against scratch git repositories rather than this one, because some cases
need repository states this repository cannot be put into (an unborn HEAD) or
should not hold (a file whose name contains a quote).

Exits non-zero on a mismatch, so it works as a pre-flight check rather than a
report to read.
"""

import os
import pathlib
import subprocess
import sys
import tempfile

REPO = pathlib.Path(__file__).resolve().parent.parent
LIB = REPO / ".claude/hooks/lib-review-scope.sh"

# Mirrors how the two hooks call it: under `set -euo pipefail`, capturing the
# output, and treating a non-zero return as "cannot decide". Exit 3 is this
# harness's marker for that branch, distinct from any status bash itself returns.
RUNNER = f'set -euo pipefail; . "{LIB}"; if ! S=$(review_scope); then exit 3; fi; printf "%s" "$S"'

failures = []


def check(label, actual, expected):
    ok = actual == expected
    if not ok:
        failures.append(label)
    print(f"  {'ok  ' if ok else 'FAIL'} {label}: {actual!r} (expected {expected!r})")


def git(cwd, *args):
    return subprocess.run(
        # commit.gpgsign is true globally on some machines; a fixture commit must
        # never wait on pinentry.
        ["git", "-c", "user.email=t@example.com", "-c", "user.name=t",
         "-c", "commit.gpgsign=false", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=True,
    )


def scope(cwd, env=None):
    """Returns (refused, paths). `refused` is True when the function returned non-zero."""
    out = subprocess.run(
        ["bash", "-c", RUNNER], cwd=cwd, capture_output=True, text=True, env=env
    )
    if out.returncode == 3:
        return True, []
    assert out.returncode == 0, f"harness error ({out.returncode}): {out.stderr}"
    return False, [line for line in out.stdout.split("\n") if line]


def repo():
    """A scratch repository with one committed file."""
    tmp = tempfile.mkdtemp(prefix="review-scope-")
    git(tmp, "init", "-q", ".")
    pathlib.Path(tmp, "seed.txt").write_text("seed\n")
    git(tmp, "add", "seed.txt")
    git(tmp, "commit", "-qm", "seed")
    return tmp


print("a clean tree is a success with nothing recorded")
r = repo()
check("clean tree", scope(r), (False, []))

print("editing a tracked file lists it, and editing it again does not change that")
# The property the whole design rests on: the scope is the set of paths, so
# applying a review's fix leaves it identical and the stamp still covers it.
r = repo()
seed = pathlib.Path(r, "seed.txt")
seed.write_text("first\n")
_, first = scope(r)
seed.write_text("a different edit entirely\n")
_, second = scope(r)
check("the path is listed", first, ["seed.txt"])
check("a further edit leaves the scope identical", second, first)

print("an untracked file is in scope, so new work is visible")
r = repo()
pathlib.Path(r, "brand-new.txt").write_text("new\n")
_, paths = scope(r)
check("the new path is listed", paths, ["brand-new.txt"])

print("a non-ASCII path is recorded under its real name")
# git C-quotes non-ASCII paths unless core.quotePath is off. This repository's own
# docs are Japanese, so the case is ordinary here rather than exotic.
r = repo()
pathlib.Path(r, "日本語.txt").write_text("one\n")
_, paths = scope(r)
check("not C-quoted", paths, ["日本語.txt"])

print("a leading-dash path is recorded, not swallowed")
r = repo()
pathlib.Path(r, "-rf").write_text("dash\n")
refused, paths = scope(r)
check("the batch still computes", refused, False)
check("and the path is listed", paths, ["-rf"])

print("a deletion is recorded as a change")
r = repo()
os.remove(pathlib.Path(r, "seed.txt"))
_, paths = scope(r)
check("the removed path is listed", paths, ["seed.txt"])

print("an unborn HEAD is a refusal, not an empty scope")
# `git diff … HEAD` exits non-zero before the first commit, while `ls-files
# --others` cannot see staged content because it is tracked. Reported as "nothing
# changed", that state let any commit through — and committing there is an
# ordinary git operation, not a corruption.
tmp = tempfile.mkdtemp(prefix="review-scope-unborn-")
git(tmp, "init", "-q", ".")
pathlib.Path(tmp, "a.txt").write_text("staged before any commit\n")
git(tmp, "add", "a.txt")
check("refuses instead of reporting a clean tree", scope(tmp)[0], True)

print("one git call failing is enough to refuse")
# The unborn-HEAD case fails both calls together. This pins the `&&` in the
# exit-status check: weakening it to `||` would let a half-known state through.
r = repo()
pathlib.Path(r, "seed.txt").write_text("dirty\n")
shim = tempfile.mkdtemp(prefix="review-scope-shim-")
real_git = subprocess.run(
    ["bash", "-c", "command -v git"], capture_output=True, text=True
).stdout.strip()
assert real_git, "git not found on PATH"
pathlib.Path(shim, "git").write_text(
    '#!/bin/sh\nfor a in "$@"; do [ "$a" = ls-files ] && exit 128; done\nexec '
    + real_git
    + ' "$@"\n'
)
os.chmod(pathlib.Path(shim, "git"), 0o755)
shim_env = dict(os.environ, PATH=shim + os.pathsep + os.environ["PATH"])
check("ls-files failing alone still refuses", scope(r, env=shim_env)[0], True)

print("a path the stamp format cannot represent is refused")
# Even with core.quotePath off, git quotes a path holding a quote, a backslash or
# a control character, and one-path-per-line cannot carry a name with a newline.
# The cost is a repository that cannot commit until the file is renamed; the
# alternative is a recorded line that means something other than what it says.
r = repo()
try:
    pathlib.Path(r, 'we"ird.txt').write_text("x\n")
except OSError:
    print("  skip  the filesystem rejected the name")
else:
    check("refuses rather than mis-recording", scope(r)[0], True)

print()
if failures:
    print(f"FAILED: {len(failures)}")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print("all checks passed")
