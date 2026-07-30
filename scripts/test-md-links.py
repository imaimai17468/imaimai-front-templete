"""Exercise scripts/check-md-links.py against the shapes it has to judge.

    python3 scripts/test-md-links.py

A link checker that reports "clean" is indistinguishable from one that finds
nothing at all, so every case it must catch and every case it must not report is
pinned here. The false-positive half matters as much as the other: this repository
quotes example link syntax inside code spans and fences (ADR-0021 records the
retired ADR cross-link form that way), and a checker that flagged those would be
switched off within a day.

Run it after touching check-md-links.py. Exits non-zero on a mismatch.
"""

import atexit
import importlib.util
import os
import pathlib
import sys
import tempfile

REPO = pathlib.Path(__file__).resolve().parent.parent

spec = importlib.util.spec_from_file_location("check_md_links", REPO / "scripts/check-md-links.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

_TMP = tempfile.TemporaryDirectory(prefix="md-links-check-")
atexit.register(_TMP.cleanup)
WORK = pathlib.Path(_TMP.name)
(WORK / "sub").mkdir()
(WORK / "real.md").write_text("# real\n")
(WORK / "sub/nested.md").write_text("# nested\n")
(WORK / "has(parens).md").write_text("# parens\n")
(WORK / "with space.md").write_text("# space\n")

failures = []


def dead_links(body):
    """Return the dead targets check-md-links reports for one document."""
    doc = WORK / "doc.md"
    doc.write_text(body)
    found = []
    for line_no, raw in mod.link_targets(mod.strip_code(body)):
        cleaned = mod.clean_target(raw)
        # `target_exists`, not a bare `.exists()` — mirroring what main() calls. This
        # helper used `.exists()` and therefore could not see the case-sensitivity
        # defect at all: a harness that does not walk the real code path is testing a
        # program that does not ship.
        if cleaned is None:
            continue
        # resolve() returns None for a target no path in the repository can satisfy
        # (a root-relative `..` climbing above the root), and main() counts that as
        # dead. Mirrored here for the same reason the line below calls target_exists
        # rather than .exists().
        target = mod.resolve(doc, cleaned)
        if target is None or not mod.target_exists(target):
            found.append((line_no, cleaned))
    return found


def check(label, body, expected):
    """expected: list of dead targets, in order."""
    actual = [raw for _line, raw in dead_links(body)]
    ok = actual == expected
    if not ok:
        failures.append(label)
    print(f"  {'ok  ' if ok else 'FAIL'} {label}: {actual} (expected {expected})")


print("a dead relative link is reported")
check("missing sibling", "see [x](./gone.md)\n", ["./gone.md"])
check("missing nested", "see [x](sub/gone.md)\n", ["sub/gone.md"])
check("missing parent-relative", "see [x](../gone.md)\n", ["../gone.md"])
check("image target", "![alt](./gone.png)\n", ["./gone.png"])
check("reference definition", "[ref]: ./gone.md\n", ["./gone.md"])
# A caret is only footnote syntax when it LEADS the label. Excluding it anywhere
# made `[a^b]: ./gone.md` invisible, silently skipping a dead link.
check("reference label with a non-leading caret", "[a^b]: ./gone.md\n", ["./gone.md"])
check("footnote definition is still skipped", "[^note]: ./gone.md\n", [])
check("two on one line", "[a](./g1.md) [b](./g2.md)\n", ["./g1.md", "./g2.md"])

print("a live relative link is not reported")
check("sibling", "see [x](./real.md)\n", [])
check("sibling without ./", "see [x](real.md)\n", [])
check("nested", "see [x](sub/nested.md)\n", [])
check("directory target", "see [x](./sub)\n", [])
check("live reference definition", "[ref]: ./real.md\n", [])

print("targets that are not paths in this repository are skipped")
check("https", "[x](https://example.com/gone.md)\n", [])
check("http", "[x](http://example.com/gone.md)\n", [])
check("mailto", "[x](mailto:nobody@example.com)\n", [])
check("protocol-relative", "[x](//example.com/gone.md)\n", [])
check("same-document anchor", "[x](#some-heading)\n", [])
check("empty target", "[x]()\n", [])

print("fragments and queries address a real file")
check("live file with anchor", "[x](./real.md#heading)\n", [])
check("dead file with anchor reports the file", "[x](./gone.md#heading)\n", ["./gone.md"])
check("live file with query", "[x](./real.md?plain=1)\n", [])
check("anchor only is not a dead file", "[x](#real.md)\n", [])

print("quoted example syntax is not a link — the false-positive half")
check("inline code span", "the form `](0015-flat.md)` is retired\n", [])
check("double backtick span", "``a ` and ](./gone.md)`` here\n", [])
check(
    "fenced block",
    "text\n```\nsee [x](./gone.md)\n```\nmore\n",
    [],
)
check(
    "fenced block with info string",
    "text\n```markdown\n[x](./gone.md)\n```\n",
    [],
)
check(
    "tilde fence",
    "text\n~~~\n[x](./gone.md)\n~~~\n",
    [],
)
check(
    "indented fence",
    "text\n  ```\n  [x](./gone.md)\n  ```\n",
    [],
)
check(
    "longer fence is not closed by a shorter run",
    "````\n```\n[x](./gone.md)\n```\n````\n",
    [],
)
check(
    "a link after a closed fence is still checked",
    "```\n[a](./inside.md)\n```\n[b](./gone.md)\n",
    ["./gone.md"],
)
check(
    "an unterminated backtick run does not swallow the rest",
    "a ` stray tick then [x](./gone.md)\n",
    ["./gone.md"],
)

# Six defects found by an adversarial audit on 2026-07-30, each reproduced against
# the shipped module before being fixed. The first two are false positives, the next
# three false negatives, and the last two break the local-gate/CI equivalence.
print("indented code is deliberately NOT treated as code")
# Reverted on 2026-07-30. The implementation looked right, passed its own tests, and
# still made the first case below invisible — a false negative, which in a gate is
# silent. The false positive it was fixing lived in this checker's own docstring,
# which is fenced now. See strip_code's docstring.
check(
    "a link after a fenced block inside a list stays visible",
    "- item\n\n    ```\n    code\n    ```\n\n    [x](./gone.md)\n",
    ["./gone.md"],
)
check("a nested list item stays visible", "- top\n    - [x](./gone.md)\n", ["./gone.md"])
check(
    "an indented example IS reported — the accepted cost",
    "Usage:\n\n    See [x](./gone.md)\n",
    ["./gone.md"],
)

print("a UTF-8 BOM must not defeat fence detection")
check("BOM then a first-line fence", "﻿```\n[x](./gone.md)\n```\n", [])

print("shapes that were invisible")
check("raw HTML anchor", 'See <a href="./gone.md">here</a>.\n', ["./gone.md"])
check("HTML anchor, single quotes", "<a href='./gone.md'>x</a>\n", ["./gone.md"])
check("HTML anchor, unquoted", "<a href=./gone.md>x</a>\n", ["./gone.md"])
check("HTML anchor to a live file", '<a href="./real.md">x</a>\n', [])
check("reference definition in a blockquote", "> [ref]: ./gone.md\n", ["./gone.md"])
check("nested blockquote definition", ">> [ref]: ./gone.md\n", ["./gone.md"])
# An escaped paren used to make the balanced scan never reach depth 0, so the link
# was dropped entirely — the checker could not tell dead from alive because it never
# looked, which is worse than reporting the wrong answer.
check("escaped paren in the destination", "[x](./no\\(such.md)\n", ["./no\\(such.md"])
# The escape must not swallow a newline: `i += 2` jumps over the escaped character
# without testing it, so a backslash immediately before a line end carried the scan
# into the next line and produced a target with an embedded newline, breaking the
# "an unclosed link ends at the line end" guarantee. A live link was then reported
# dead, because clean_target() truncated the corrupted destination at the newline.
#
# Two shapes, because the first one alone certified the bug as fixed for a while: its
# expected answer is recovered by a SECOND `](` match inside the text the broken scan
# swallowed, so it passed while the merging was still happening. Only the isolated
# shape below — no second link to rescue it — actually fails when the escape branch
# skips past the newline.
check(
    "a backslash at line end does not join the next line",
    "[x](abc\\\n[y](./gone.md)\n",
    ["./gone.md"],
)
check(
    "backslash-escaped newline does not merge lines (isolated)",
    "[x](abc\\\ndef)\n",
    [],
)
# `\b` is satisfied by a hyphen or colon, so these read as the real attribute. A
# `data-href` usually drives JavaScript and points at nothing on disk.
check("data-href is not an href", '<a data-href="./gone.md">x</a>\n', [])
check("aria-href is not an href", '<a aria-href="./gone.md">x</a>\n', [])
check("xlink:href is not an href", '<a xlink:href="./gone.md">x</a>\n', [])
check("href in a fenced block stays quoted", '```\n<a href="./gone.md">x</a>\n```\n', [])
check("an anchor to an external URL is skipped", '<a href="https://x.test/a.md">x</a>\n', [])
check("an anchor to a fragment is skipped", '<a href="#top">x</a>\n', [])

print("target syntax that a naive regex gets wrong")
check("title after target", '[x](./real.md "the title")\n', [])
check("dead target with title reports only the path", '[x](./gone.md "the title")\n', ["./gone.md"])
# An unbracketed destination cannot contain a space, so the parens case is only
# well-formed without one; `[x](<./with space.md>)` below is how a spaced path is
# actually written. A regex stopping at the first `)` would truncate this to
# `./has(parens` and call an existing file dead.
check("balanced parens", "[x](./has(parens).md)\n", [])
check("dead balanced parens", "[x](./no(such).md)\n", ["./no(such).md"])
check("angle brackets with space", "[x](<./with space.md>)\n", [])
check("percent-encoded space", "[x](./with%20space.md)\n", [])
check("newline before close paren is not a link", "[x](./gone.md\n)\n", [])

print("root-relative targets resolve against the repository root")
check("live root-relative", "[x](/README.md)\n", [])
check("dead root-relative", "[x](/nope-does-not-exist.md)\n", ["/nope-does-not-exist.md"])
# `/` means the repository root, so climbing above it names nothing this checker can
# accept: resolve() returns None and the link is dead. Without the clamp it returned
# the escaped path, and a same-named file in the parent directory (a nested checkout,
# a sibling package) reported the link LIVE — a false negative, which is the failure
# mode this gate cannot afford because nothing announces it. Decided 2026-07-30
# between clamping and leaving it to disk; clamping was chosen.
ok = mod.resolve(WORK / "doc.md", "/../anything.md") is None
if not ok:
    failures.append("root-relative escape not clamped")
print(f"  {'ok  ' if ok else 'FAIL'} a root-relative target climbing above the root resolves to None")
# The case that actually bites: the escaped path EXISTS. Uses a real sibling of the
# repository rather than creating one, because a test has no business writing outside
# the repository it checks. Skipped rather than faked when the checkout has no sibling.
_sibling = next(
    (e for e in sorted(os.listdir(REPO.parent)) if e != REPO.name and not e.startswith(".")),
    None,
)
if _sibling is None:
    print(f"  SKIP no sibling of {REPO.name} on disk to point at")
else:
    check(f"root-relative escape onto a real sibling ({_sibling})", f"[x](/../{_sibling})\n", [f"/../{_sibling}"])

# On a case-insensitive filesystem (APFS by default) `Path.exists()` answers True for
# the wrong case, so a wrong-case link passed the local Stop gate and failed in CI —
# splitting the local gate from the step meant to be redundant with it (ADR-0013).
# `target_exists` checks each component against real directory entries instead.
print("a wrong-case target is dead even where the filesystem disagrees")
check("exact case", "[x](./real.md)\n", [])
check("wrong case on the file", "[x](./REAL.MD)\n", ["./REAL.MD"])
check("wrong case in a directory", "[x](./SUB/nested.md)\n", ["./SUB/nested.md"])
check("wrong case, live file, live dir", "[x](./sub/NESTED.md)\n", ["./sub/NESTED.md"])
ok = mod.target_exists(WORK / "real.md") and not mod.target_exists(WORK / "REAL.MD")
if not ok:
    failures.append("target_exists case check")
print(f"  {'ok  ' if ok else 'FAIL'} target_exists distinguishes case directly")

print("a root-relative target with .. still resolves")
# The root-relative branch was not normalised, so a literal `..` survived into
# target_exists()'s component walk, where no real directory lists `..`.
ok = mod.target_exists(mod.resolve(WORK / "doc.md", "/AGENTS.md"))
ok2 = mod.target_exists(mod.resolve(WORK / "doc.md", "/docs/../AGENTS.md"))
for label, got in (("plain root-relative", ok), ("root-relative through ..", ok2)):
    if not got:
        failures.append(label)
    print(f"  {'ok  ' if got else 'FAIL'} {label} resolves to a live file")

print("the listdir cache does not outlive one scan")
# Cached per directory and never refreshed, a file created after its parent was first
# listed read as dead for the rest of the process — and this harness shares one.
#
# Exercised through main(), which is where the clearing lives. The first version of
# this block called `mod._LISTDIR_CACHE.clear()` itself and then checked
# target_exists(), so it passed whether or not main() cleared anything — verified by
# deleting the clear from main() and watching all 71 checks still pass. A test that
# cannot fail certifies the fix instead of covering it.
cache_dir = WORK / "cache-check"
cache_dir.mkdir()
doc = cache_dir / "doc.md"
(cache_dir / "seed.md").write_text("# seed\n")
# Primed through resolve(), not with a bare path: resolve() calls .resolve(), which
# rewrites macOS's /var -> /private/var symlink, so a bare cache_dir key never
# collides with the one main() goes on to use and the priming becomes a no-op.
mod.target_exists(mod.resolve(doc, "./seed.md"))
(cache_dir / "created-later.md").write_text("# later\n")
doc.write_text("[x](./created-later.md)\n")
rc = mod.main([str(doc)])
ok = rc == 0
if not ok:
    failures.append("cache staleness across main() invocations")
print(f"  {'ok  ' if ok else 'FAIL'} main() clears the cache before its own scan (exit {rc}, expected 0)")

print("a symlinked .md is skipped, not followed outside the repository")
outside = WORK / "outside.md"
outside.write_text("[x](./nowhere-at-all.md)\n")
link = WORK / "linked.md"
try:
    link.symlink_to(outside)
    rc = mod.main([str(link)])
    ok = rc == 0
    if not ok:
        failures.append("symlink skipped")
    print(f"  {'ok  ' if ok else 'FAIL'} a symlink is not read (exit {rc}, expected 0)")
finally:
    if link.is_symlink():
        link.unlink()

print("line numbers point at the link")
_lines = dead_links("one\ntwo\n[x](./gone.md)\n")
check_line = _lines[0][0] if _lines else None
ok = check_line == 3
if not ok:
    failures.append("line number")
print(f"  {'ok  ' if ok else 'FAIL'} line number: {check_line} (expected 3)")

print("the checker exits non-zero when a link is dead")
(WORK / "bad.md").write_text("[x](./gone.md)\n")
rc_bad = mod.main([str(WORK / "bad.md")])
rc_good = mod.main([str(WORK / "real.md")])
for label, actual, expected in (("dead exits 1", rc_bad, 1), ("clean exits 0", rc_good, 0)):
    ok = actual == expected
    if not ok:
        failures.append(label)
    print(f"  {'ok  ' if ok else 'FAIL'} {label}: {actual} (expected {expected})")

print()
if failures:
    print(f"FAILED: {len(failures)}")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print("all checks passed")
