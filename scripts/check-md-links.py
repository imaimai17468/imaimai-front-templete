"""Report markdown links that point at files which do not exist.

```
python3 scripts/check-md-links.py            # every .md file git knows about
python3 scripts/check-md-links.py a.md b.md  # only these
```

Fenced, not indented, on purpose: this checker does not treat 4-space-indented
blocks as code (see `strip_code`), so an indented example here would be scanned as
prose and reported as a dead link. That is the accepted trade — see that docstring.

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

    **Indented (4-space) code blocks are deliberately NOT recognised**, though
    CommonMark says they are code. Handling them was implemented and reverted on
    2026-07-30, and the reason is worth keeping: a code block cannot interrupt a
    paragraph, and inside a list the same indentation is list *content*, so any rule
    simple enough to state here misjudges one of the two. The implementation looked
    right, passed its own tests, and still made a link after a fenced block inside a
    list invisible — a false negative, which in a gate is silent, and therefore worse
    than the false positive it was fixing.

    The false positive it was fixing was in this very file's docstring, which used to
    write its usage examples 4-space indented. Those are fenced now. That is the
    whole trade: a genuine indented code block elsewhere gets *reported*, which is
    visible and fixed by adding a fence, whereas a missed link is not visible at all.
    """
    out = []
    fence = None  # the opening fence's (char, length) while inside a block
    for line in text.split("\n"):
        # A UTF-8 BOM is not whitespace, so `lstrip()` leaves it in front of a
        # first-line fence and the fence stops being recognised — everything to the
        # closing fence then reads as prose. Editors add one silently.
        line = line.lstrip("﻿")
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
            # A line end terminates the scan: an unclosed link ends at the line end.
            if text[i] == "\n":
                break
            # A backslash escapes the next character, so an escaped paren is part of
            # the destination and must not move the depth. Counting it did, so
            # `[x](notes\(draft.md)` never reached depth 0 and the whole link was
            # dropped from the scan — the checker could not tell dead from alive
            # because it never looked, which is worse than a false positive.
            #
            # The escaped character is inspected before being skipped, because the
            # skip is what can cross a line end: `i += 2` jumps over text[i+1]
            # without ever testing it, so a backslash immediately before a newline
            # carried the scan into the next line and produced a destination with an
            # embedded newline. Testing for the newline earlier in this loop does
            # NOT prevent that — both tests read the same index and are mutually
            # exclusive on one character, so ordering them cannot help. An earlier
            # attempt at this fix did exactly that, and its test passed only because
            # a second `](` match inside the swallowed text happened to recover the
            # right answer; the isolated shape `[x](abc\<newline>def)` still merged
            # the lines. The consequence was a LIVE link reported dead, because
            # clean_target() then truncated the corrupted destination at the newline.
            if text[i] == "\\":
                if i + 1 >= len(text) or text[i + 1] == "\n":
                    break
                i += 2
                continue
            if text[i] == "(":
                depth += 1
            elif text[i] == ")":
                depth -= 1
                if not depth:
                    break
            i += 1
        if depth:
            continue
        yield text.count("\n", 0, m.start()) + 1, text[m.end() : i]

    # Raw HTML anchors. Legal in CommonMark and used here for anchors and styling;
    # `](` never appears in them, so they were entirely invisible.
    # `(?<![\w:-])` rather than `\b`: a word boundary is satisfied by a hyphen or a
    # colon too, so `data-href`, `aria-href` and `xlink:href` were read as the real
    # attribute. `data-href` in particular usually drives JavaScript and points at
    # nothing on disk, so that was a false positive able to block a commit. The colon
    # was missed on the first attempt at this fix — `\w` and `-` alone still let
    # `xlink:href` through.
    for m in re.finditer(
        r"""(?i)<a\s[^>]*?(?<![\w:-])href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)""", text
    ):
        raw = m.group(1).strip("\"'")
        yield text.count("\n", 0, m.start()) + 1, raw
    # Reference definitions: `[label]: target "optional title"`.
    # The lookahead skips footnote definitions (`[^note]: ...`), whose target is
    # prose rather than a path. It has to be a lookahead on the FIRST character
    # rather than `^` inside the character class: excluding the caret everywhere
    # made any label merely containing one — `[a^b]: ./gone.md` — invisible, so a
    # genuinely dead link went unreported.
    #
    # `(?:>[ \t]?)*` allows blockquote markers: a definition inside a blockquote is
    # still a definition, and anchoring on `[` alone skipped it.
    for m in re.finditer(
        r"(?m)^[ \t]{0,3}(?:>[ \t]?)*[ \t]{0,3}\[(?!\^)[^\]]+\]:[ \t]*(\S+)", text
    ):
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


_LISTDIR_CACHE = {}


def target_exists(path):
    """True when `path` exists AND every component's case matches the disk.

    `Path.exists()` is a bare `stat()`, so on a case-insensitive filesystem (APFS
    by default on macOS) `./HTMLREF.MD` resolves to `htmlref.md` and a wrong-case
    link passes. CI runs on ext4 and fails it. That split the local gate from the
    CI step that is supposed to be redundant with it — a contributor would be told
    "clean" locally and surprised by CI, which is precisely the equivalence
    ADR-0013 assumes. So the case is verified explicitly rather than delegated to
    the filesystem.

    Directory listings are cached: a document with many links otherwise re-reads the
    same directory once per link.
    """
    if not path.exists():
        return False
    # Walk from the anchor down, checking each component against its parent's real
    # directory entries.
    parts = list(path.parts)
    if not parts:
        return False
    current = pathlib.Path(parts[0])
    for part in parts[1:]:
        key = str(current)
        entries = _LISTDIR_CACHE.get(key)
        if entries is None:
            try:
                entries = set(os.listdir(current))
            except OSError:
                return False
            _LISTDIR_CACHE[key] = entries
        if part not in entries:
            return False
        current = current / part
    return True


def resolve(md_path, cleaned):
    """Return the path a cleaned target refers to, or None if it cannot be one.

    None means "no path in this repository can satisfy this target", which the
    caller treats as dead. It is distinct from `clean_target` returning None,
    which means "not a repository-relative target at all" and is skipped.
    """
    # Both branches are normalised. The root-relative one was not, so a `..`
    # segment survived into target_exists()'s component walk, where no real
    # directory ever lists `..` — a live file read as dead.
    if cleaned.startswith("/"):
        target = (REPO / cleaned.lstrip("/")).resolve()
        # `/` here means "the repository root", so a target with enough `..` to
        # climb above it (`/../x`) names nothing this checker can accept. Returning
        # the escaped path instead let a same-named file in the parent directory —
        # a nested checkout, a sibling package — report the link live: a false
        # negative, which is the one failure mode a silent gate cannot afford.
        #
        # The ordinary relative branch below is deliberately NOT clamped the same
        # way. `../` there is how a document legitimately points at a sibling file,
        # and the checker's question for it is only "does this resolve on disk";
        # clamping it would reject working links. The asymmetry is the point: the
        # two branches answer different questions.
        if target != REPO and REPO not in target.parents:
            return None
        return target
    return (md_path.parent / cleaned).resolve()


def reached_via_symlink(path):
    """True when `path`, or any directory between the repo root and it, is a symlink.

    Checking only the final component was not enough: with `docs/linked -> /elsewhere`
    and `docs/linked/real.md` an ordinary file, `is_symlink()` on the full path is
    False and the OS follows the link transparently, so the read escaped the
    repository anyway.

    Deliberately NOT implemented as `path.resolve() != path`. On macOS `/var` and
    `/tmp` are themselves symlinks into `/private`, so that comparison would flag
    every fixture the test harness creates under a temp directory. Only components
    *inside* the repository are inspected; a path the caller passed from outside the
    repository is the caller's own choice, and this walk stops before it.
    """
    if path.is_symlink():
        return True
    try:
        rel = path.relative_to(REPO)
    except ValueError:
        return False
    current = REPO
    for part in rel.parts[:-1]:
        current = current / part
        if current.is_symlink():
            return True
    return False


def md_files(argv):
    if argv:
        # `absolute()`, not `resolve()`: resolve() follows symlinks, which would
        # defeat the symlink check in main() for explicitly-named files — the path
        # would already be the target by the time anything asked.
        return [pathlib.Path(a).absolute() for a in argv]

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
    # One scan, one cache. It is keyed by directory, so a file created after that
    # directory was first listed would otherwise read as dead for the rest of the
    # process — which matters because the test harness and any watch-mode caller
    # invoke main() more than once.
    _LISTDIR_CACHE.clear()
    dead = []
    skipped = 0
    files = md_files(argv)
    for md in files:
        # A `*.md` symlink passes `--exclude-standard` (which filters by .gitignore,
        # not by file type), and reading it followed the link to wherever it pointed
        # — an editor swap file, a build artifact, anything on disk the user can
        # read. A gate has no business reading outside the repository, so symlinks
        # are skipped out loud rather than silently.
        if reached_via_symlink(md):
            print(f"  SKIP {os.path.relpath(md, REPO)}: symlink, not followed")
            skipped += 1
            continue
        try:
            text = md.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            print(f"  SKIP {os.path.relpath(md, REPO)}: {exc}")
            skipped += 1
            continue
        for line_no, raw in link_targets(strip_code(text)):
            cleaned = clean_target(raw)
            if cleaned is None:
                continue
            target = resolve(md, cleaned)
            if target is not None and target_exists(target):
                continue
            dead.append((os.path.relpath(md, REPO), line_no, cleaned))

    if dead:
        print(f"Dead markdown links: {len(dead)}")
        for path, line_no, raw in dead:
            print(f"  {path}:{line_no}  ->  {raw}")
        print("\nEach target above does not exist on disk, or exists under a")
        print("different case. Fix the path, or drop the link and name the thing")
        print("in plain text.")
        return 1
    checked = len(files) - skipped
    note = f", {skipped} skipped" if skipped else ""
    print(f"markdown links ok ({checked} files checked{note}, no dead relative links)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
