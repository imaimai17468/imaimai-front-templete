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
        if cleaned is not None and not mod.resolve(doc, cleaned).exists():
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
