#!/usr/bin/env bun

/**
 * Report markdown links that point at files which do not exist.
 *
 * ```
 * bun .claude/hooks/check-md-links.ts            # every .md file git knows about
 * bun .claude/hooks/check-md-links.ts a.md b.md  # only these
 * ```
 *
 * Fenced, not indented, on purpose: this checker does not treat 4-space-indented
 * blocks as code (see `stripCode`), so an indented example here would be scanned
 * as prose and reported as a dead link.
 *
 * Exists because the review pipeline was being used as a link checker. A dead
 * link is decidable by opening the path, so it belongs in a gate rather than in a
 * reviewer's judgment.
 *
 * It answers exactly one question: does the target of a relative link resolve to
 * something on disk? Anchors are not validated (the target's heading structure is
 * a different problem) and external URLs are not fetched (a gate must not depend
 * on the network). Returns a non-zero exit code when any link is dead.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HERE = import.meta.dirname;
const REPO = path.resolve(HERE, "../..");

// A link target is skipped when it addresses something other than a path in this
// repository. `//host/x` is protocol-relative and `#frag` is a same-document
// anchor; both are as external as `https:` for our purposes.
const SKIP_PREFIXES = ["#", "//"] as const;
const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/u;
const FENCE = /^(?:`{3,}|~{3,})/u;

/**
 * Blank out the code spans in one line, preserving every other column.
 *
 * A run of N backticks closes on the next run of exactly N. Written as a scan
 * rather than a regex so that `` ` `` inside a double-backtick span does not
 * terminate it. A run whose candidate close is part of a longer run is literal
 * text, and the scan resumes after the run rather than hunting for another close.
 */
const blankCodeSpans = (line: string, from: number): string => {
  const at = line.indexOf("`", from);
  if (at === -1) {
    return line;
  }
  const run = /^`+/u.exec(line.slice(at))?.[0] ?? "";
  const close = line.indexOf(run, at + run.length);
  if (close === -1 || line.charAt(close + run.length) === "`") {
    return blankCodeSpans(line, at + run.length);
  }
  const end = close + run.length;
  return blankCodeSpans(
    line.slice(0, at) + " ".repeat(end - at) + line.slice(end),
    end
  );
};

/**
 * Blank out fenced blocks and inline code spans, preserving line numbers.
 *
 * Required, not cosmetic: documents here quote retired cross-link syntax inside
 * code spans, and `.claude/skills/` files show example paths inside fences. Those
 * are quoted text, not links — reporting them would train the reader to ignore
 * this check. Replacement is space-for-character so every surviving link keeps
 * its real line and column.
 *
 * **Indented (4-space) code blocks are deliberately NOT recognised**, though
 * CommonMark says they are code. A code block cannot interrupt a paragraph, and
 * inside a list the same indentation is list *content*, so any rule simple enough
 * to state here misjudges one of the two. Handling them made a link after a
 * fenced block inside a list invisible — a false negative, which in a gate is
 * silent and therefore worse than the false positive it was fixing. A genuine
 * indented code block elsewhere gets *reported*, which is visible and fixed by
 * adding a fence.
 */
export const stripCode = (text: string): string => {
  // The opening fence's char and length while inside a block; null between them.
  let fence: { char: string; length: number } | null = null;
  return text
    .split("\n")
    .map((rawLine) => {
      // A UTF-8 BOM is not whitespace, so it sits in front of a first-line fence
      // and the fence stops being recognised — everything to the closing fence
      // then reads as prose. Editors add one silently.
      const line = rawLine.replace(/^﻿+/u, "");
      const marker = FENCE.exec(line.trimStart())?.[0];
      if (fence === null) {
        // An info string may follow the opening fence, but a closing fence must
        // carry nothing else — so opening and closing are distinguished by state,
        // not by content.
        if (marker !== undefined) {
          fence = { char: marker.charAt(0), length: marker.length };
          return "";
        }
        return blankCodeSpans(line, 0);
      }
      if (
        marker !== undefined &&
        marker.startsWith(fence.char) &&
        marker.length >= fence.length
      ) {
        fence = null;
      }
      return "";
    })
    .join("\n");
};

// One `(`, one `)`, or a backslash with whatever it escapes. A lone trailing
// backslash matches as a single-character token, which is how the scan below
// tells "escapes the next character" from "there is no next character".
const PAREN_SCAN = /\\[^]?|[()]/gu;

interface ParenToken {
  index: number;
  text: string;
}

/**
 * Index of the token that drops `depth` to zero, or null when none does.
 *
 * Recurses over the tokens PAREN_SCAN matches rather than every character, so
 * the recursion takes one frame per `(`, `)`, or backslash on the line.
 */
const balancedClose = (
  tokens: ParenToken[],
  cursor: number,
  depth: number
): number | null => {
  const token = tokens[cursor];
  if (!token) {
    return null;
  }
  // A backslash escapes the next character, so an escaped paren is part of the
  // destination and must not move the depth. Counting it did, so
  // `[x](notes\(draft.md)` never reached depth 0 and the whole link was dropped
  // from the scan; the checker could not tell dead from alive because it never
  // looked. A backslash with nothing after it ends the scan: the caller sliced
  // to the line end, so "no next character" and "next character is a newline"
  // are the same condition, and reading past it produced a destination with an
  // embedded newline that truncated to something absent, reporting a live link
  // dead.
  if (token.text.startsWith("\\")) {
    return token.text.length === 1
      ? null
      : balancedClose(tokens, cursor + 1, depth);
  }
  if (token.text === "(") {
    return balancedClose(tokens, cursor + 1, depth + 1);
  }
  return depth === 1
    ? token.index
    : balancedClose(tokens, cursor + 1, depth - 1);
};

/**
 * Index of the `)` closing a link destination that starts at `from`, or null.
 *
 * Markdown permits `](dir/file(1).md)`, so the scan is balanced; a regex stopping
 * at the first `)` would silently check a truncated path and call it dead. The
 * slice ends at the line end because an unclosed link ends there.
 */
const closingParen = (text: string, from: number): number | null => {
  const lineEnd = text.indexOf("\n", from);
  const limit = lineEnd === -1 ? text.length : lineEnd;
  // `match.index` is a UTF-16 code unit offset into the slice and is added back
  // to `from`, a code unit index into `text`. A code-point walk would drift by
  // one per surrogate pair.
  const tokens = [...text.slice(from, limit).matchAll(PAREN_SCAN)].map(
    (match) => ({ index: from + match.index, text: match[0] })
  );
  return balancedClose(tokens, 0, 1);
};

// Raw HTML anchors. Legal in CommonMark and used here for anchors and styling;
// `](` never appears in them, so they were entirely invisible.
// `(?<![\w:-])` rather than `\b`: a word boundary is satisfied by a hyphen or a
// colon too, so `data-href`, `aria-href` and `xlink:href` were read as the real
// attribute. `data-href` in particular usually drives JavaScript and points at
// nothing on disk, so that was a false positive able to block a commit.
const HTML_HREF =
  /<a\s[^>]*?(?<![\w:-])href\s*=\s*(?<value>"[^"]*"|'[^']*'|[^\s>]+)/giu;

// Reference definitions: `[label]: target "optional title"`.
// The lookahead skips footnote definitions (`[^note]: ...`), whose target is
// prose rather than a path. It has to be a lookahead on the FIRST character
// rather than excluding the caret everywhere: that made any label merely
// containing one — `[a^b]: ./gone.md` — invisible, so a genuinely dead link went
// unreported. `(?:>[ \t]?)*` allows blockquote markers, since a definition inside
// a blockquote is still a definition.
const REF_DEF =
  /^[ \t]{0,3}(?:>[ \t]?)*[ \t]{0,3}\[(?!\^)[^\]]+\]:[ \t]*(?<target>\S+)/gmu;

const INLINE_OPEN = /\]\(/gu;

export interface LinkTarget {
  line: number;
  raw: string;
}

const lineOf = (text: string, index: number): number =>
  text.slice(0, index).split("\n").length;

const stripQuotes = (value: string): string =>
  value.replace(/^["']+/u, "").replace(/["']+$/u, "");

/** Inline links, raw HTML anchors, and reference definitions, in that order. */
export const linkTargets = (text: string): LinkTarget[] => {
  const inline = [...text.matchAll(INLINE_OPEN)].flatMap((match) => {
    const start = match.index + match[0].length;
    const end = closingParen(text, start);
    return end === null
      ? []
      : [{ line: lineOf(text, match.index), raw: text.slice(start, end) }];
  });
  const html = [...text.matchAll(HTML_HREF)].flatMap((match) => {
    const value = match.groups?.value;
    return value === undefined
      ? []
      : [{ line: lineOf(text, match.index), raw: stripQuotes(value.trim()) }];
  });
  const refs = [...text.matchAll(REF_DEF)].flatMap((match) => {
    const value = match.groups?.target;
    return value === undefined
      ? []
      : [{ line: lineOf(text, match.index), raw: value }];
  });
  return [...inline, ...html, ...refs];
};

// `decodeURIComponent` throws on a malformed escape where Python's `unquote`
// leaves it as written. A target nobody percent-encoded is the common case, so a
// malformed one is passed through rather than reported on its encoding.
const unquote = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * Reduce a raw link target to the path it addresses, or null to skip it.
 *
 * Kept separate from `resolveTarget` so the report can name the path rather than
 * echoing the raw target — `[x](./gone.md "a title")` is a dead link to
 * `./gone.md`, and printing the title back makes the reader hunt for a file
 * whose name includes it.
 */
export const cleanTarget = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  // `[x](<my file.md>)` — angle brackets quote a target containing spaces.
  // An unbracketed destination cannot contain a space (CommonMark: that is what
  // the angle-bracket form is for), so anything from the first space onwards is
  // the optional title.
  const target =
    trimmed.startsWith("<") && trimmed.includes(">")
      ? trimmed.slice(1, trimmed.indexOf(">"))
      : (trimmed.split(/\s+/u)[0] ?? "");
  if (
    target === "" ||
    SKIP_PREFIXES.some((prefix) => target.startsWith(prefix)) ||
    SCHEME.test(target)
  ) {
    return null;
  }
  // Drop the fragment and query — `file.md#section` addresses a real file.
  const addressed = (target.split("#")[0] ?? "").split("?")[0] ?? "";
  return addressed === "" ? null : unquote(addressed);
};

const listdirCache = new Map<string, Set<string>>();

const listdir = (dir: string): Set<string> | null => {
  const cached = listdirCache.get(dir);
  if (cached !== undefined) {
    return cached;
  }
  try {
    const entries = new Set(fs.readdirSync(dir));
    listdirCache.set(dir, entries);
    return entries;
  } catch {
    return null;
  }
};

/**
 * True when `target` exists AND every component's case matches the disk.
 *
 * `existsSync` is a bare `stat()`, so on a case-insensitive filesystem (APFS by
 * default on macOS) `./HTMLREF.MD` resolves to `htmlref.md` and a wrong-case link
 * passes, while CI on ext4 fails it. That split the local gate from the CI step
 * that is supposed to be redundant with it, so the case is verified explicitly
 * rather than delegated to the filesystem.
 *
 * Directory listings are cached: a document with many links otherwise re-reads
 * the same directory once per link.
 */
export const targetExists = (target: string): boolean => {
  if (!fs.existsSync(target)) {
    return false;
  }
  const { root } = path.parse(target);
  const parts = path
    .relative(root, target)
    .split(path.sep)
    .filter((part) => part !== "");
  return parts.every((part, depth) => {
    const entries = listdir(path.join(root, ...parts.slice(0, depth)));
    return entries !== null && entries.has(part);
  });
};

/**
 * The path a cleaned target refers to, or null if no path can satisfy it.
 *
 * null means "no path in this repository can satisfy this target", which the
 * caller treats as dead. It is distinct from `cleanTarget` returning null, which
 * means "not a repository-relative target at all" and is skipped.
 */
export const resolveTarget = (
  mdPath: string,
  cleaned: string
): string | null => {
  if (cleaned.startsWith("/")) {
    const target = path.resolve(REPO, cleaned.replace(/^\/+/u, ""));
    // `/` here means "the repository root", so a target with enough `..` to climb
    // above it (`/../x`) names nothing this checker can accept. Returning the
    // escaped path instead let a same-named file in the parent directory — a
    // nested checkout, a sibling package — report the link live: a false
    // negative, which is the one failure mode a silent gate cannot afford.
    //
    // The ordinary relative branch below is deliberately NOT clamped the same
    // way. `../` there is how a document legitimately points at a sibling file,
    // and the checker's question for it is only "does this resolve on disk";
    // clamping it would reject working links.
    if (target !== REPO && !target.startsWith(REPO + path.sep)) {
      return null;
    }
    return target;
  }
  return path.resolve(path.dirname(mdPath), cleaned);
};

const isSymlink = (target: string): boolean => {
  try {
    return fs.lstatSync(target).isSymbolicLink();
  } catch {
    return false;
  }
};

/**
 * True when `target`, or any directory between the repo root and it, is a symlink.
 *
 * Checking only the final component was not enough: with `docs/linked -> /elsewhere`
 * and `docs/linked/real.md` an ordinary file, a symlink test on the full path is
 * false and the OS follows the link transparently, so the read escaped the
 * repository anyway.
 *
 * Deliberately NOT implemented by comparing against a fully resolved path. On
 * macOS `/var` and `/tmp` are themselves symlinks into `/private`, so that
 * comparison would flag every fixture a test harness creates under a temp
 * directory. Only components *inside* the repository are inspected; a path the
 * caller passed from outside the repository is the caller's own choice.
 */
export const reachedViaSymlink = (target: string): boolean => {
  if (isSymlink(target)) {
    return true;
  }
  const rel = path.relative(REPO, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return false;
  }
  const ancestors = rel.split(path.sep).slice(0, -1);
  return ancestors
    .map((_part, depth) => path.join(REPO, ...ancestors.slice(0, depth + 1)))
    .some(isSymlink);
};

const gitListed = (extra: readonly string[]): Set<string> => {
  const out = execFileSync(
    "git",
    ["-C", REPO, "ls-files", "-z", ...extra, "*.md"],
    { encoding: "utf-8" }
  );
  return new Set(out.split("\0").filter((entry) => entry !== ""));
};

export const mdFiles = (argv: readonly string[]): string[] => {
  if (argv.length > 0) {
    // Resolved without following symlinks, which would defeat the symlink check
    // in main() for explicitly-named files — the path would already be the target
    // by the time anything asked.
    return argv.map((arg) => path.resolve(arg));
  }
  // Tracked AND untracked-but-not-ignored. `--exclude-standard` keeps
  // node_modules and build output out for free, while a newly authored document
  // that has not been `git add`ed yet still gets checked — that is the file most
  // likely to carry a fresh dead link, and scoping to tracked paths exempted it.
  // This mirrors stop-gate.sh, which already treats untracked files as in scope.
  const listed = new Set([
    ...gitListed([]),
    ...gitListed(["--others", "--exclude-standard"]),
  ]);
  return [...listed].toSorted().map((entry) => path.join(REPO, entry));
};

interface Dead {
  file: string;
  line: number;
  target: string;
}

interface FileResult {
  dead: Dead[];
  skipped: boolean;
}

const scanFile = (md: string): FileResult => {
  // A `*.md` symlink passes `--exclude-standard` (which filters by .gitignore,
  // not by file type), and reading it follows the link to wherever it points — an
  // editor swap file, a build artifact, anything on disk the user can read. A
  // gate has no business reading outside the repository, so symlinks are skipped
  // out loud rather than silently.
  if (reachedViaSymlink(md)) {
    console.log(`  SKIP ${path.relative(REPO, md)}: symlink, not followed`);
    return { dead: [], skipped: true };
  }
  const read = ((): string | null => {
    try {
      return fs.readFileSync(md, "utf-8");
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      console.log(`  SKIP ${path.relative(REPO, md)}: ${reason}`);
      return null;
    }
  })();
  if (read === null) {
    return { dead: [], skipped: true };
  }
  const dead = linkTargets(stripCode(read)).flatMap(({ line, raw }) => {
    const cleaned = cleanTarget(raw);
    if (cleaned === null) {
      return [];
    }
    const target = resolveTarget(md, cleaned);
    if (target !== null && targetExists(target)) {
      return [];
    }
    return [{ file: path.relative(REPO, md), line, target: cleaned }];
  });
  return { dead, skipped: false };
};

export const main = (argv: readonly string[]): number => {
  // One scan, one cache. It is keyed by directory, so a file created after that
  // directory was first listed would otherwise read as dead for the rest of the
  // process — which matters because a test harness invokes main() more than once.
  listdirCache.clear();
  const files = mdFiles(argv);
  const results = files.map(scanFile);
  const dead = results.flatMap((result) => result.dead);

  if (dead.length > 0) {
    console.log(`Dead markdown links: ${dead.length}`);
    console.log(
      dead
        .map(({ file, line, target }) => `  ${file}:${line}  ->  ${target}`)
        .join("\n")
    );
    console.log(
      "\nEach target above does not exist on disk, or exists under a"
    );
    console.log(
      "different case. Fix the path, or drop the link and name the thing"
    );
    console.log("in plain text.");
    return 1;
  }
  const skipped = results.filter((result) => result.skipped).length;
  const checked = files.length - skipped;
  const note = skipped > 0 ? `, ${skipped} skipped` : "";
  console.log(
    `markdown links ok (${checked} files checked${note}, no dead relative links)`
  );
  return 0;
};

const [, entry] = process.argv;
if (entry !== undefined && path.resolve(entry) === import.meta.filename) {
  process.exit(main(process.argv.slice(2)));
}
