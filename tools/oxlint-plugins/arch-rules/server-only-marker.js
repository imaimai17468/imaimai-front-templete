import { srcPathOf } from "./file-paths.js";
import { layerOf } from "./layers.js";

const SERVER_ONLY_MARKER = "@tanstack/react-start/server-only";

/**
 * Which environment runs a module that `src/lib` holds, decided by the
 * directory it sits in. The longest matching prefix wins, so a browser
 * directory nested inside a server one stays a browser directory. A gateway is
 * decided by `layerOf` instead, in `classifyModule`.
 *
 * A client module importing a marked module fails the build on that module
 * rather than on whatever specifier its deepest import trips, and the marker
 * inside a module the browser runs fails the client build on that file.
 */
const MARKER_DIRECTORIES = [
  {
    hint: "`src/lib/auth/session/` is the half the server runs and `src/lib/auth/sign-in/` the half the browser runs.",
    prefix: "src/lib/auth/",
    runs: "server",
  },
  {
    hint: "`src/lib/auth/session/` is the half the server runs and `src/lib/auth/sign-in/` the half the browser runs.",
    prefix: "src/lib/auth/sign-in/",
    runs: "client",
  },
];

const MARKER_DIRECTORIES_MOST_SPECIFIC_FIRST = MARKER_DIRECTORIES.toSorted(
  (a, b) => b.prefix.length - a.prefix.length
);

const GATEWAY_BROWSER_SUFFIX = ".fn.ts";

const GATEWAY_HINT =
  "Write the `createServerFn` declarations in a `*.fn.ts`, and put everything else in a module that file imports.";

/** What the message calls the module, and which environment runs it. */
const classifyModule = (srcPath) => {
  if (layerOf(srcPath) === "gateway") {
    if (srcPath.endsWith(GATEWAY_BROWSER_SUFFIX)) {
      return {
        hint: GATEWAY_HINT,
        runs: "client",
        subject: `A \`*${GATEWAY_BROWSER_SUFFIX}\``,
      };
    }
    return {
      hint: GATEWAY_HINT,
      runs: "server",
      subject: "A module in a `gateway/` directory",
    };
  }
  const directory = MARKER_DIRECTORIES_MOST_SPECIFIC_FIRST.find((entry) =>
    srcPath.startsWith(entry.prefix)
  );
  if (directory === undefined) {
    return null;
  }
  return {
    hint: directory.hint,
    runs: directory.runs,
    subject: `A module under \`${directory.prefix}\``,
  };
};

const carriesMarker = (program) =>
  program.body.some(
    (statement) =>
      statement.type === "ImportDeclaration" &&
      statement.source.value === SERVER_ONLY_MARKER &&
      // TypeScript erases a type-only import, so the marker would not ship and
      // the module would reach a client bundle unguarded.
      statement.importKind !== "type"
  );

const markerReport = ({ hint, runs, subject }, marked) => {
  if (runs === "server" && !marked) {
    return `${subject} must open with \`import "${SERVER_ONLY_MARKER}";\`, so a client module importing it fails the build on this file. ${hint}`;
  }
  if (runs === "client" && marked) {
    return `${subject} reaches the browser, so \`import "${SERVER_ONLY_MARKER}";\` here fails the client build. ${hint}`;
  }
  return null;
};

const serverOnlyMarker = {
  create(context) {
    const srcPath = srcPathOf(context);
    if (srcPath === null || srcPath.endsWith(".test.ts")) {
      return {};
    }
    const module = classifyModule(srcPath);
    if (module === null) {
      return {};
    }

    return {
      Program(node) {
        const message = markerReport(module, carriesMarker(node));
        if (message === null) {
          return;
        }
        context.report({ message, node });
      },
    };
  },
};

export default serverOnlyMarker;
