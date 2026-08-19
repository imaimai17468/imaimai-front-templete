"""Exercise .claude/hooks/pre-bash-guard.sh against the shapes it must judge.

    python3 scripts/test-bash-guard.py

The guard carries three decisions that are easy to break and impossible to
notice: the protected-env-file block, the `find` gate, and the commit gate. Each case
below feeds the real hook a synthetic PreToolUse payload and asserts the decision
it returns. Nothing in the repository is modified and no command from a case is
ever executed.

Run it after touching pre-bash-guard.sh. Exits non-zero on a mismatch.
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
HOOK = REPO / ".claude/hooks/pre-bash-guard.sh"

# A project directory that already holds a review stamp. The guard runs its three
# decisions in order, so a case built to probe the env or `find` decision with a
# commit-shaped command still reaches the commit gate — and would then be judged
# by whether this session happens to have earned a stamp. Pointing such a case at
# this directory keeps it testing the decision it names.
# A unique directory per run, removed at exit. A fixed shared path under the
# system temp dir would let two concurrent runs clobber each other's fixture, and
# the `rmtree` that kept it clean would delete whatever else happened to occupy
# that name.
# `atexit` runs on a normal exit and on an uncaught exception, but not on SIGKILL,
# an OOM kill, or a segfault — a hard-killed run leaves its directory behind, and
# no later run will match the random name to clean it. Sweeping the prefix at
# startup would restore that self-healing and delete the live directory of a
# concurrent run, which is the bug this replaced, so it is deliberately not done.
_STAMPED_TMP = tempfile.TemporaryDirectory(prefix="bash-guard-stamped-")
atexit.register(_STAMPED_TMP.cleanup)
STAMPED = pathlib.Path(_STAMPED_TMP.name)
(STAMPED / ".claude").mkdir(parents=True)
# It has to be a real repository with a clean tree, not just a directory holding a
# marker. The gate no longer stops at "a stamp exists": it reads the working tree's
# changed paths, and a directory git cannot read is a refusal ("cannot decide"),
# which would turn every case pointed here into a block for a reason the case is
# not about. A clean tree has an empty scope, so containment holds against any
# stamp — and the marker has to be ignored, or it would itself be a changed path.
subprocess.run(["git", "init", "-q", "."], cwd=STAMPED, check=True)
(STAMPED / ".gitignore").write_text(".claude/.*\n")
subprocess.run(["git", "add", ".gitignore"], cwd=STAMPED, check=True)
subprocess.run(
    # commit.gpgsign is true globally on some machines; never wait on pinentry.
    ["git", "-c", "user.email=t@example.com", "-c", "user.name=t",
     "-c", "commit.gpgsign=false", "commit", "-qm", "seed"],
    cwd=STAMPED,
    check=True,
)
(STAMPED / ".claude" / (".review-" + "stamp")).touch()

# Split so this file's own text is not itself a commit-shaped command.
LAND = "git " + "com" + "mit"

STAMP = REPO / ".claude" / (".review-" + "stamp")

# The stamp is no longer a flag: it lists the paths the review read, and the gate
# compares the working tree's changed paths against that list
# (lib-review-scope.sh). A case that saves the stamp therefore has to restore its
# BYTES — an earlier version restored with touch(), handing the session back an
# empty stamp that refuses every commit it used to authorise.


def save_stamp():
    return STAMP.read_bytes() if STAMP.exists() else None


def restore_stamp(saved):
    if saved is None:
        if STAMP.exists():
            STAMP.unlink()
    else:
        STAMP.write_bytes(saved)


failures = []


def decide(command, project_dir=REPO, hook=None):
    """Return the hook's decision for a Bash command: 'allow', 'block', or 'ask'.

    `hook` points at a copy of the guard when a case needs its neighbouring
    libraries to be absent — the guard resolves them relative to its own path.
    """
    payload = {"tool_name": "Bash", "tool_input": {"command": command}}
    out = subprocess.run(
        ["bash", str(hook or HOOK)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        env={**os.environ, "CLAUDE_PROJECT_DIR": str(project_dir)},
    ).stdout.strip()
    if not out:
        return "allow"  # the hook stayed out of the way
    parsed = json.loads(out)
    if parsed.get("decision") == "block":
        return "block"
    decision = parsed.get("hookSpecificOutput", {}).get("permissionDecision")
    return decision or "allow"


def check(command, expected, why, project_dir=REPO, hook=None):
    actual = decide(command, project_dir, hook)
    ok = actual == expected
    if not ok:
        failures.append(f"{why}: {command}")
    print(f"  {'ok  ' if ok else 'FAIL'} {actual:5s} (want {expected:5s})  {why}")


print("find: scoped discovery runs unattended")
check("find node_modules/vitest -name '*.js'", "allow", "subdirectory root")
check("find src -type f -name '*.tsx'", "allow", "subdirectory root")
check("find ./src/lib -name '*.ts'", "allow", "./ prefix but scoped")
check("find docs -newer README.md", "allow", "metadata predicate")
check("find src -type f | xargs grep -l useState", "allow", "piped into a reader, scoped")

print("find: broad reach is refused")
check("find . -type f", "block", "repository root")
check("find . -type f | xargs cat", "block", "the read-everything shape")
check("find ./ -name '*.ts'", "block", "bare ./")
check("find / -name id_rsa", "block", "filesystem root")
check("find ~ -name '*.pem'", "block", "home directory")
check("find .. -type f", "block", "parent directory")
check("find src/../ -type f", "block", "escapes upward")
check("find $HOME -type f", "block", "variable root")
check("find -name '*.ts'", "block", "no root operand at all")

print("find: actions that run or delete are refused, even when scoped")
check("find src -name '*.log' -delete", "block", "-delete")
check("find src -type f -exec cat {} ;", "block", "-exec")
check("find src -type d -execdir ls {} ;", "block", "-execdir")
check("find src -type f -fls /tmp/out", "block", "-fls")

# The first version of Guard 2 matched one regex anchored on the character after
# `find `, and a reviewer broke it twice — once with quotes, once with a second
# root. Both classes stay here permanently.
print("find: quoting must not hide the shape")
check('find "." -type f | xargs cat', "block", "double-quoted root")
check("find '.' -type f", "block", "single-quoted root")
check('find "/" -type f', "block", "quoted filesystem root")
check('find "$HOME" -type f', "block", "quoted variable root")
check('find ".." -type f', "block", "quoted parent")
check('find src "-exec" cat {} +', "block", "quoted action flag")
check("find src '-delete'", "block", "quoted -delete")

print("find: a broad root hidden behind a narrow one is still caught")
check("find src / -type f", "block", "second root is the filesystem root")
check("find src . -type f", "block", "second root is the repository")
check("find src ~ -type f", "block", "second root is the home directory")
check("find src / -type f | xargs cat", "block", "multi-root read-everything")
check("find src docs -name '*.md'", "allow", "two scoped roots stay unattended")
check("find src -name '../x'", "allow", "'..' inside a predicate value is not a root")

print("find: text inside a heredoc is data, not a command")
# The first version of this guard refused the very commit that introduced it,
# because the message body described `find . | xargs cat`.
check(
    "git add x && " + LAND + " -F - <<'MSG'\nrefuse find . -type f | xargs cat and -delete\nMSG",
    "allow",
    "a commit message describing the dangerous shapes",
    project_dir=STAMPED,
)
check("cat <<'EOF'\nfind / -delete\nEOF", "allow", "heredoc body naming a dangerous find")

print("env protection still blocks")
check("cat .env.local", "block", "direct read")
check("grep SECRET .env", "block", "grep read")
check("cat .env.local.example", "allow", "the example file is readable")

print("commit gate: a shell metacharacter against `git` must not escape it")
# Verified hole, 2026-07-30: the pattern required the character before `git` to be
# start-of-string or one of `;&| `, so a metacharacter glued directly against the
# command word matched none of them and the whole gate was skipped — no stamp
# needed. `(cd sub && ...)` was caught only because the space after `&&` happened to
# match. Now resolved through lib-commit-shape.sh, shared with the consume hook.
_saved = save_stamp()
try:
    if STAMP.exists():
        STAMP.unlink()
    for shape, why in (
        (LAND, "the plain form"),
        (f"({LAND})", "subshell, no space before git"),
        (f"$({LAND})", "command substitution"),
        (f"`{LAND}`", "backtick substitution"),
        (f"{{ {LAND}; }}", "brace group"),
        (f"(cd sub && {LAND})", "subshell with a cd first"),
        (f"if true; then {LAND}; fi", "inside a conditional"),
        (f"{LAND};true", "operator glued after commit"),
    ):
        check(shape, "block", f"unstamped — {why}")
finally:
    restore_stamp(_saved)

print("commit gate: shapes bash resolves before dispatch must not slip past")
# All three were found by the review of the change that introduced the shared
# matcher, and all three really commit under bash 3.2.57 — verified with a stub
# `git` that printed its argv. The third is the worst kind: the continuation
# handling added to close one gap opened another, because bash joins a
# backslash-newline with NOTHING and the first version substituted a space,
# splitting the verb into `com` + `mit`.
VERB = "com" + "mit"
_saved2 = save_stamp()
try:
    if STAMP.exists():
        STAMP.unlink()
    check(f"git '{VERB}' -m x", "block", "quoted verb — quotes are removed before dispatch")
    check("git${IFS}" + VERB + " -m x", "block", "${IFS} performs real word splitting")
    check("git co\\\nmm\\\nit -m x", "block", "continuation splitting the verb itself")
    # bash reads `$IFScommit` as one undefined variable name, so no commit runs and
    # nothing needs to block. Pinned so a future 'fix' does not add a false positive.
    check("git $IFS" + VERB + " -m x", "allow", "$IFScommit is one variable name, not a commit")
finally:
    restore_stamp(_saved2)

print("commit gate: shapes that only mention the word still run unattended")
check("git log --grep=" + "com" + "mit", "allow", "searching for the word is not committing")
check("git checkout -b feature/" + "com" + "mit-fix", "allow", "a branch named for it")
check("git status; echo " + "com" + "mit", "allow", "a separator is not crossed")

print("commit gate follows what the stamp recorded, not merely that it exists")
# Driven against a scratch repository with a deliberately dirty tree, NOT against
# this one. An earlier version read the real project directory, so on a run where
# the working tree happened to be clean the scope was empty and the assertions
# that matter most were skipped while the suite still reported success. A case
# that only runs when the ambient tree cooperates is not a pinned case.
_GATE_TMP = tempfile.TemporaryDirectory(prefix="bash-guard-gate-")
atexit.register(_GATE_TMP.cleanup)
GATE = pathlib.Path(_GATE_TMP.name)
(GATE / ".claude").mkdir(parents=True)
subprocess.run(["git", "init", "-q", "."], cwd=GATE, check=True)
(GATE / ".gitignore").write_text(".claude/.*\n")
(GATE / "tracked.txt").write_text("reviewed\n")
subprocess.run(["git", "add", ".gitignore", "tracked.txt"], cwd=GATE, check=True)
subprocess.run(
    # commit.gpgsign is true globally on some machines; never wait on pinentry.
    ["git", "-c", "user.email=t@example.com", "-c", "user.name=t",
     "-c", "commit.gpgsign=false", "commit", "-qm", "seed"],
    cwd=GATE,
    check=True,
)
(GATE / "tracked.txt").write_text("edited, awaiting review\n")  # guarantees a dirty tree

GATE_STAMP = GATE / ".claude" / (".review-" + "stamp")


def gate_scope():
    out = subprocess.run(
        ["bash", "-c", f'. "{REPO}/.claude/hooks/lib-review-scope.sh"; review_scope'],
        cwd=GATE,
        capture_output=True,
        text=True,
    )
    assert out.returncode == 0, f"review_scope failed: {out.stderr}"
    assert out.stdout.strip(), "the fixture tree must be dirty for these cases to mean anything"
    return out.stdout


gate_sc = gate_scope()

check(f"{LAND} -m x", "block", "unstamped commit", project_dir=GATE)

GATE_STAMP.write_text(gate_sc)
check(f"{LAND} -m x", "allow", "stamp lists every changed path", project_dir=GATE)

# An empty stamp is what touch() used to produce, and it must not authorise
# anything any more: nothing is recorded, so nothing is covered.
GATE_STAMP.write_text("")
check(f"{LAND} -m x", "block", "empty stamp covers nothing", project_dir=GATE)

# THE property the design exists for: editing a file the review already read —
# which is what applying a finding's fix looks like — keeps the stamp valid. The
# review stays one pass.
GATE_STAMP.write_text(gate_sc)
(GATE / "tracked.txt").write_text("the fix the review asked for\n")
check(f"{LAND} -m x", "allow", "a fix to a reviewed file keeps the stamp", project_dir=GATE)

# ...while a file the review never saw does not. This is the hole that motivated
# binding the stamp to something at all: without it, one review's stamp authorised
# the next, unrelated commit.
(GATE / "never-reviewed.txt").write_text("new work\n")
check(f"{LAND} -m x", "block", "a file the review never saw", project_dir=GATE)
os.remove(GATE / "never-reviewed.txt")

# Containment, not equality: a stamp listing MORE than the tree carries still
# authorises. That is a split mid-flight — the committed paths have left
# `git diff HEAD` and the rest are still covered.
GATE_STAMP.write_text(gate_sc + "path/not/in/the/tree.txt\n")
check(
    f"{LAND} -m x",
    "allow",
    "stamp lists more than the tree — a split in progress",
    project_dir=GATE,
)

# A path is matched whole: `tracked.txt` must not be authorised by a stamp that
# only lists `tracked.txt.bak`, and a dash-leading path must not be read by grep
# as its own options.
GATE_STAMP.write_text("tracked.txt.bak\n")
check(f"{LAND} -m x", "block", "a longer path does not cover a shorter one", project_dir=GATE)
(GATE / "-rf").write_text("dash\n")
GATE_STAMP.write_text(gate_sc + "-rf\n")
check(f"{LAND} -m x", "allow", "a dash-leading path can be matched", project_dir=GATE)
os.remove(GATE / "-rf")

print("a missing scope library denies rather than falls through")
# The guard sources lib-review-scope.sh from its own directory and denies when it
# is absent. Untested, that branch is the same shape as the 644-permission
# incident: a gate that silently stops deciding. Driven with a stamp in place that
# WOULD authorise, so a fallthrough would show up as an allow.
_NOLIB_TMP = tempfile.TemporaryDirectory(prefix="bash-guard-nolib-")
atexit.register(_NOLIB_TMP.cleanup)
NOLIB = pathlib.Path(_NOLIB_TMP.name) / "hooks"
NOLIB.mkdir(parents=True)
for _h in ("pre-bash-guard.sh", "lib-commit-shape.sh"):
    shutil.copy(REPO / ".claude/hooks" / _h, NOLIB / _h)
# lib-review-scope.sh is deliberately NOT copied.
GATE_STAMP.write_text(gate_sc)
check(
    f"{LAND} -m x",
    "block",
    "no scope library — cannot decide, so refuses",
    project_dir=GATE,
    hook=NOLIB / "pre-bash-guard.sh",
)

print()
if failures:
    print(f"FAILED: {len(failures)}")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print("all checks passed")
