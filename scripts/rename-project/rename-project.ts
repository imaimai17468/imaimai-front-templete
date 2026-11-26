/**
 * What `bun run rename-project <name>` rewrites when a fork takes a project
 * name of its own. `rename-project.entry.ts` reads and writes the files.
 */

import { Array, pipe, String } from "effect";

/** A tracked file and the text it holds. */
export interface TrackedFile {
  readonly path: string;
  readonly text: string;
}

export type RenamePlan =
  | { readonly kind: "rejected"; readonly reason: string }
  | {
      readonly files: readonly TrackedFile[];
      readonly from: string;
      readonly kind: "rename";
      readonly to: string;
    };

/**
 * A name npm accepts unscoped and portless can put in a host name: lowercase
 * letters and digits, joined by single hyphens.
 */
const PROJECT_NAME = /^[a-z\d]+(?:-[a-z\d]+)*$/u;

/** The longest label a host name holds. */
const MAX_NAME_LENGTH = 63;

const nameProblem = (name: string, from: string): readonly string[] =>
  pipe(
    [
      [
        !PROJECT_NAME.test(name),
        "use lowercase letters, digits and single hyphens",
      ],
      [
        name.length > MAX_NAME_LENGTH,
        `use at most ${MAX_NAME_LENGTH} characters`,
      ],
      [name === from, `the project is already named ${from}`],
    ] satisfies (readonly [boolean, string])[],
    Array.filter(([fails]) => fails),
    Array.map(([, reason]) => reason)
  );

/** The `"name"` field `package.json` and the root of `bun.lock` carry. */
const nameField = (name: string) => `"name": "${name}"`;

const MANIFESTS = new Set(["bun.lock", "package.json"]);

const SOURCE_FILE = /^src\/.+\.tsx?$/u;

const RENAMED_FILE_TYPE =
  /\.(?:cjs|css|html|js|json|jsonc|lock|md|mjs|mts|sh|toml|ts|tsx|ya?ml)$/u;

/** Whether a tracked file at `path` is text this command reads for the name. */
export const isRenamedFileType = (path: string): boolean =>
  RENAMED_FILE_TYPE.test(path);

/** Whether the working tree holds changes no commit records. */
export type WorktreeState = "clean" | "dirty";

/**
 * The dev server's host name for `name`, at a name boundary, so renaming `app`
 * leaves `webapp.localhost` alone. `name` passed `PROJECT_NAME`, so it holds
 * no character a pattern reads specially.
 */
const devHost = (name: string) =>
  new RegExp(`(?<![a-z\\d-])${name}\\.localhost`, "gu");

/**
 * `text` with every occurrence of `from` that names the project rewritten to
 * `to`: the manifest's own name, a service key's leading segment, and the
 * host name portless serves the dev server under.
 */
const renamedText = (
  { path, text }: TrackedFile,
  from: string,
  to: string
): string => {
  const withManifestName = MANIFESTS.has(path)
    ? String.replace(nameField(from), nameField(to))(text)
    : text;
  const withServiceKeys = SOURCE_FILE.test(path)
    ? String.replaceAll(`()("${from}/`, `()("${to}/`)(withManifestName)
    : withManifestName;
  return String.replaceAll(devHost(from), `${to}.localhost`)(withServiceKeys);
};

/**
 * The files a rename from `from` to the name `argv` gives rewrites, each with
 * its new text, or the reason the rename cannot run. A tree with uncommitted
 * changes is refused, so `git checkout .` undoes a run that fails partway.
 */
export const planRename = (
  argv: readonly string[],
  from: string,
  files: readonly TrackedFile[],
  worktree: WorktreeState
): RenamePlan => {
  if (!Array.isReadonlyArrayNonEmpty(argv) || argv.length > 1) {
    return { kind: "rejected", reason: "usage: bun run rename-project <name>" };
  }
  if (worktree === "dirty") {
    return {
      kind: "rejected",
      reason: "commit or stash your changes before renaming",
    };
  }
  if (!PROJECT_NAME.test(from)) {
    return {
      kind: "rejected",
      reason: `package.json names the project ${from}, which this command cannot rename`,
    };
  }
  const to = Array.headNonEmpty(argv);
  const problems = nameProblem(to, from);
  if (Array.isReadonlyArrayNonEmpty(problems)) {
    return { kind: "rejected", reason: `${to}: ${problems.join("; ")}` };
  }
  return {
    files: pipe(
      files,
      Array.flatMap((file) => {
        const text = renamedText(file, from, to);
        return text === file.text ? [] : [{ path: file.path, text }];
      })
    ),
    from,
    kind: "rename",
    to,
  };
};
