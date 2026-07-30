"""Report markdown links that point at files which do not exist.

    python3 scripts/check-md-links.py            # every .md file git knows about
    python3 scripts/check-md-links.py a.md b.md  # only these

Exists because the review pipeline was being used as a link checker. On
2026-07-29 a consolidation deleted `docs/adr/` and `docs/superpowers/`, and the
dead relative links left behind in other documents were found by the
`code-reviewer` agent — three separate times, after three separate claims that
the rewiring was complete. A dead link is decidable by opening the path, so it
belongs in a gate, not in a reviewer's judgment (ADR-0013).

It answers exactly one question: does the target of a relative link resolve to
something on disk? Anchors are not validated (the target's heading structure is
a different problem) and external URLs are not fetched (a gate must not depend on
the network). Exits non-zero when any link is dead, so it works as a gate.
"""

import os
import pathlib
import re
import subprocess
import sys
import urllib.parse

REPO = pathlib.Path(__file__).resolve().parent.parent

# A link target is skipped when it addresses something other than a path in this
# repository. `//host/x` is protocol-relative and `#frag` is a same-document
# anchor; both are as external as `https:` for our purposes.
SKIP_PREFIXES = ("#", "//")
SCHEME = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")


def strip_code(text):
    """Blank out fenced blocks and inline code spans, preserving line numbers.

    Required, not cosmetic: `aegis-share/source/documents/adr-0021.md` documents
    the retired ADR cross-link syntax as `` `](0015-flat-review-pipeline.md)` ``,
    and `.claude/skills/` files show example paths inside fences. Those are
    quoted text, not links — reporting them would train the reader to ignore this
    check. Replacement is space-for-character so every surviving link keeps its
    real line and column.
    """
    out = []
    fence = None  # the opening fence's (char, length) while inside a block
    for line in text.split("\n"):
        stripped = line.lstrip()
        m = re.match(r"^(`{3,}|~{3,})", stripped)
        if fence is None:
            # An info string may follow the opening fence, but a closing fence
            # must carry nothing else — so opening and closing are distinguished
            # by state, not by content.
            if m:
                fence = (m.group(1)[0], len(m.group(1)))
                out.append("")
                continue
        else:
            if m and m.group(1)[0] == fence[0] and len(m.group(1)) >= fence[1]:
                fence = None
            out.append("")
            continue
        # Inline code: a run of N backticks closes on the next run of exactly N.
        # Scanned rather than regexed so that `` ` `` inside a double-backtick
        # span does not terminate it.
        buf = []
        i = 0
        while i < len(line):
            if line[i] == "`":
                n = 0
                while i + n < len(line) and line[i + n] == "`":
                    n += 1
                close = line.find("`" * n, i + n)
                # An unterminated run is literal text, so keep it as-is.
                if close == -1 or (close + n < len(line) and line[close + n] == "`"):
                    buf.append(line[i : i + n])
                    i += n
                    continue
                buf.append(" " * (close + n - i))
                i = close + n
                continue
            buf.append(line[i])
            i += 1
        out.append("".join(buf))
    return "\n".join(out)


def link_targets(text):
    """Yield (line_number, raw_target) for inline links and reference definitions.

    Inline targets are read with a balanced-paren scan because markdown permits
    `](dir/file(1).md)`; a regex stopping at the first `)` would silently check a
    truncated path and call it dead.
    """
    for m in re.finditer(r"\]\(", text):
        i = m.end()
        depth = 1
        while i < len(text) and depth:
            if text[i] == "(":
                depth += 1
            elif text[i] == ")":
                depth -= 1
                if not depth:
                    break
            elif text[i] == "\n":
                break
            i += 1
        if depth:
            continue
        yield text.count("\n", 0, m.start()) + 1, text[m.end() : i]
    # Reference definitions: `[label]: target "optional title"`.
    # The lookahead skips footnote definitions (`[^note]: ...`), whose target is
    # prose rather than a path. It has to be a lookahead on the FIRST character
    # rather than `^` inside the character class: excluding the caret everywhere
    # made any label merely containing one — `[a^b]: ./gone.md` — invisible, so a
    # genuinely dead link went unreported.
    for m in re.finditer(r"(?m)^[ \t]{0,3}\[(?!\^)[^\]]+\]:[ \t]*(\S+)", text):
        yield text.count("\n", 0, m.start()) + 1, m.group(1)


def clean_target(target):
    """Reduce a raw link target to the path it addresses, or None to skip it.

    Kept separate from `resolve` so the report can name the path rather than
    echoing the raw target — `[x](./gone.md "a title")` is a dead link to
    `./gone.md`, and printing the title back makes the reader hunt for a file
    whose name includes it.
    """
    target = target.strip()
    if not target:
        return None
    # `[x](<my file.md>)` — angle brackets quote a target containing spaces.
    if target.startswith("<") and ">" in target:
        target = target[1 : target.index(">")]
    else:
        # An unbracketed destination cannot contain a space (CommonMark: that is
        # what the angle-bracket form is for), so anything from the first space
        # onwards is the optional title.
        parts = target.split()
        target = parts[0] if parts else ""
    if not target or target.startswith(SKIP_PREFIXES) or SCHEME.match(target):
        return None
    # Drop the fragment and query — `file.md#section` addresses a real file.
    target = target.split("#", 1)[0].split("?", 1)[0]
    if not target:
        return None
    return urllib.parse.unquote(target)


def resolve(md_path, cleaned):
    """Return the path a cleaned target refers to."""
    if cleaned.startswith("/"):
        return REPO / cleaned.lstrip("/")
    return (md_path.parent / cleaned).resolve()


def md_files(argv):
    if argv:
        return [pathlib.Path(a).resolve() for a in argv]

    def listed(*extra):
        out = subprocess.run(
            ["git", "-C", str(REPO), "ls-files", "-z", *extra, "*.md"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
        return {p for p in out.split("\0") if p}

    # Tracked AND untracked-but-not-ignored. `--exclude-standard` keeps
    # node_modules and build output out for free, while a newly authored document
    # that has not been `git add`ed yet still gets checked — that is the file most
    # likely to carry a fresh dead link, and scoping to tracked paths exempted it.
    # This mirrors stop-gate.sh, which already treats untracked files as in scope
    # for its own checks.
    return [REPO / p for p in sorted(listed() | listed("--others", "--exclude-standard"))]


def main(argv):
    dead = []
    files = md_files(argv)
    for md in files:
        try:
            text = md.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            print(f"  SKIP {os.path.relpath(md, REPO)}: {exc}")
            continue
        for line_no, raw in link_targets(strip_code(text)):
            cleaned = clean_target(raw)
            if cleaned is None or resolve(md, cleaned).exists():
                continue
            dead.append((os.path.relpath(md, REPO), line_no, cleaned))

    if dead:
        print(f"Dead markdown links: {len(dead)}")
        for path, line_no, raw in dead:
            print(f"  {path}:{line_no}  ->  {raw}")
        print("\nEach target above does not exist on disk. Fix the path, or drop")
        print("the link and name the thing in plain text.")
        return 1
    print(f"markdown links ok ({len(files)} files, no dead relative links)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
