/**
 * Report `.cursor/rules/*.mdc` entries that have stopped mirroring
 * `.claude/rules/*.md`, and `.cursor/skills/` or `.cursor/agents/` trees
 * that would duplicate what Cursor already reads from `.claude/`.
 *
 * A mirror is right when it is a symlink whose text is exactly
 * `../../.claude/rules/<its own name>.md` and whose target exists, and when
 * every rule has one. Returns a non-zero exit code for anything else,
 * including a `.claude/rules` that holds no rule at all, which would otherwise
 * pass with nothing compared.
 */

import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..");

const RULES = ".claude/rules";
const MIRRORS = ".cursor/rules";

const FORBIDDEN_CURSOR_DIRS = [".cursor/skills", ".cursor/agents"] as const;

/** The one link text a mirror may carry. */
const linkTextFor = (name: string): string => `../../${RULES}/${name}.md`;

/**
 * The directory's entries, or none where it cannot be read.
 *
 * Deleting `.cursor/rules` is then reported as every rule losing its mirror,
 * and deleting `.claude/rules` as a rule directory holding no rule.
 */
const readEntries = (dir: string): fs.Dirent[] => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
};

type EntryKind = "other" | "symlink";

/**
 * The `extension` entries by name with that suffix removed, each with its kind.
 *
 * The kind comes from the directory entry, where `statSync` follows the link
 * and reports a copy and the symlink it replaced identically.
 */
const kindsOf = (
  entries: readonly fs.Dirent[],
  extension: string
): Map<string, EntryKind> =>
  new Map(
    entries
      .filter((entry) => entry.name.endsWith(extension))
      .map((entry): [string, EntryKind] => [
        path.basename(entry.name, extension),
        entry.isSymbolicLink() ? "symlink" : "other",
      ])
  );

export interface MirrorProblem {
  readonly detail: string;
  readonly entry: string;
}

/** A subdirectory holds files this check never reads, so it is reported. */
const directoryProblems = (
  display: string,
  entries: readonly fs.Dirent[]
): MirrorProblem[] =>
  entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      detail: `a directory, and only the files directly in ${display} are read`,
      entry: `${display}/${entry.name}`,
    }));

/**
 * What is wrong with one name's mirror, or null when it mirrors its rule.
 *
 * The link text is compared literally rather than resolved: an absolute link
 * resolves in one checkout only, and `../../.claude/rules/../rules/prose.md`
 * reaches the right file by a spelling nothing here writes. `existsSync`
 * follows the link afterwards, so a matching text whose `../..` lands
 * somewhere else is reported rather than passed.
 */
const detailFor = (
  root: string,
  name: string,
  hasRule: boolean,
  kind: EntryKind | undefined
): string | null => {
  if (kind === undefined) {
    return `missing: add a symlink to ${linkTextFor(name)}`;
  }
  if (!hasRule) {
    return `no ${RULES}/${name}.md exists for it to mirror`;
  }
  if (kind === "other") {
    return `not a symlink to ${linkTextFor(name)}`;
  }
  const mirror = path.join(root, MIRRORS, `${name}.mdc`);
  const link = fs.readlinkSync(mirror);
  if (link !== linkTextFor(name)) {
    return `links to ${link} instead of ${linkTextFor(name)}`;
  }
  return fs.existsSync(mirror)
    ? null
    : `links to ${linkTextFor(name)}, which resolves to nothing`;
};

export interface MirrorReport {
  readonly problems: readonly MirrorProblem[];
  readonly rules: readonly string[];
}

const duplicateCursorTreeProblems = (root: string): MirrorProblem[] =>
  FORBIDDEN_CURSOR_DIRS.flatMap((entry) =>
    fs.existsSync(path.join(root, entry))
      ? [
          {
            detail:
              "exists; Cursor reads the matching tree under .claude/ directly, so remove it",
            entry,
          },
        ]
      : []
  );

/** Judges every name either directory holds, so both directions are decided. */
export const mirrorReport = (root: string): MirrorReport => {
  const ruleEntries = readEntries(path.join(root, RULES));
  const mirrorEntries = readEntries(path.join(root, MIRRORS));
  const rules = [...kindsOf(ruleEntries, ".md").keys()].toSorted();
  const mirrors = kindsOf(mirrorEntries, ".mdc");
  const ruleNames = new Set(rules);
  const emptyRules =
    rules.length === 0
      ? [
          {
            detail: "holds no rule, so this check compares nothing",
            entry: RULES,
          },
        ]
      : [];
  const broken = [...new Set([...rules, ...mirrors.keys()])]
    .toSorted()
    .flatMap((name) => {
      const detail = detailFor(
        root,
        name,
        ruleNames.has(name),
        mirrors.get(name)
      );
      return detail === null
        ? []
        : [{ detail, entry: `${MIRRORS}/${name}.mdc` }];
    });
  return {
    problems: [
      ...duplicateCursorTreeProblems(root),
      ...emptyRules,
      ...directoryProblems(RULES, ruleEntries),
      ...directoryProblems(MIRRORS, mirrorEntries),
      ...broken,
    ],
    rules,
  };
};

export const main = (argv: readonly string[]): number => {
  const { problems, rules } = mirrorReport(path.resolve(argv[0] ?? REPO));
  if (problems.length > 0) {
    console.log(
      [
        `Cursor rule mirrors out of sync: ${problems.length}`,
        ...problems.map(({ detail, entry }) => `  ${entry}: ${detail}`),
        "",
        `Every ${RULES}/<name>.md is mirrored at ${MIRRORS}/<name>.mdc as a`,
        "symlink. Create one with:",
        `  ln -s ../../${RULES}/<name>.md ${MIRRORS}/<name>.mdc`,
      ].join("\n")
    );
    return 1;
  }
  console.log(
    `cursor rule mirrors ok (${rules.length} rules, each symlinked into ${MIRRORS})`
  );
  return 0;
};
