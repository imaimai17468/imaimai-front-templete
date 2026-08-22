"""Exercise .claude/hooks/pre-bash-guard.sh against the shapes it must judge.

    python3 scripts/test-bash-guard.py

The guard carries two decisions that are easy to break and impossible to
notice: the protected-env-file block and the `find` gate. Each case
below feeds the real hook a synthetic PreToolUse payload and asserts the decision
it returns. Nothing in the repository is modified and no command from a case is
ever executed.

Run it after touching pre-bash-guard.sh. Exits non-zero on a mismatch.
"""

import json
import os
import pathlib
import subprocess
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
HOOK = REPO / ".claude/hooks/pre-bash-guard.sh"

# Split so this file's own text is not itself a commit-shaped command.
LAND = "git " + "com" + "mit"

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
)
check("cat <<'EOF'\nfind / -delete\nEOF", "allow", "heredoc body naming a dangerous find")

print("env protection still blocks")
check("cat .env.local", "block", "direct read")
check("grep SECRET .env", "block", "grep read")
check("cat .env.local.example", "allow", "the example file is readable")

print("env protection: a git message body is prose, a chained command is not")
COMMIT = "git " + "com" + "mit"
check(
    COMMIT + " -F - <<{Q}MSG{Q}\nkeep the .env guard\nMSG".format(Q="'", E=".env"),
    "allow",
    "a heredoc commit body naming the file",
)
check(
    COMMIT + " -F - <<{Q}MSG{Q}\nbody\nMSG\ncat .env".format(Q="'", E=".env"),
    "block",
    "a command chained after the terminator",
)
check(
    COMMIT + " -F - <<{Q}MSG{Q} > .env\nbody\nMSG".format(Q="'", E=".env"),
    "block",
    "a redirect on the operator line",
)
check(
    "cat <<{Q}EOF{Q}\n.env\nEOF".format(Q="'", E=".env"),
    "block",
    "a heredoc body outside a git command still blocks",
)

print()
if failures:
    print(f"FAILED: {len(failures)}")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print("all checks passed")
