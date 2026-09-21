import path from "node:path";

// An uppercase letter in any script, which is what "looks like a component"
// meant when this compared a character with its own upper- and lower-cased form.
const COMPONENT_NAME_RE = /^\p{Lu}/u;

const isComponentName = (name) =>
  typeof name === "string" && COMPONENT_NAME_RE.test(name);

const noSizeProps = {
  create(context) {
    return {
      JSXAttribute(node) {
        const propName = node.name?.name;
        if (propName !== "width" && propName !== "height") {
          return;
        }
        const openingElement = node.parent;
        if (!openingElement) {
          return;
        }
        const elementName = openingElement.name;
        if (elementName.type === "JSXMemberExpression") {
          context.report({
            message: `Do not pass '${propName}' prop to components. Control size externally via the parent's CSS layout.`,
            node,
          });
          return;
        }
        if (
          elementName.type === "JSXIdentifier" &&
          isComponentName(elementName.name)
        ) {
          context.report({
            message: `Do not pass '${propName}' prop to components. Control size externally via the parent's CSS layout.`,
            node,
          });
        }
      },
    };
  },
};

const isFunctionInit = (init) =>
  init?.type === "ArrowFunctionExpression" ||
  init?.type === "FunctionExpression";

/**
 * The component-named function declarations a module-scope statement holds,
 * reading through an `export` wrapper to the declaration under it.
 *
 * Reading `Program.body` is what reaches a declaration the file never exports.
 * Visiting `VariableDeclaration` instead would reach those, and every arrow
 * nested inside a component with it.
 */
const componentsDeclaredBy = (statement) => {
  const declaration =
    statement.type === "ExportNamedDeclaration" ||
    statement.type === "ExportDefaultDeclaration"
      ? statement.declaration
      : statement;
  if (!declaration) {
    return [];
  }
  if (
    declaration.type === "FunctionDeclaration" ||
    declaration.type === "FunctionExpression"
  ) {
    return declaration.id && isComponentName(declaration.id.name)
      ? [declaration.id.name]
      : [];
  }
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations
      .filter(
        (declarator) =>
          declarator.id?.type === "Identifier" &&
          isComponentName(declarator.id.name) &&
          isFunctionInit(declarator.init)
      )
      .map((declarator) => declarator.id.name);
  }
  return [];
};

const SKIP_STEMS = new Set(["index"]);

const TEST_STEM_SUFFIX = /\.(?:test|spec)$/u;

const isTestStem = (stem) => TEST_STEM_SUFFIX.test(stem);

/**
 * The component name a file's own name calls for, or `null` where the name
 * yields none: an empty or test stem, `index`, or a stem whose first character
 * does not upper-case (`__root`).
 */
const expectedComponentName = (filename) => {
  const basename = filename.slice(filename.lastIndexOf("/") + 1);
  const stem = basename.replace(/\.(?:tsx?|jsx?)$/u, "");
  if (stem === "" || SKIP_STEMS.has(stem) || isTestStem(stem)) {
    return null;
  }
  const name = stem
    .split(/[.-]/u)
    .map((part) =>
      part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)
    )
    .join("");
  return isComponentName(name) ? name : null;
};

const oneComponentPerFile = {
  create(context) {
    const filename = context.filename ?? context.getFilename?.();
    const namesake = filename ? expectedComponentName(filename) : null;

    return {
      Program(node) {
        const declared = node.body.flatMap((statement) =>
          componentsDeclaredBy(statement).map((name) => ({ name, statement }))
        );
        if (declared.length < 2) {
          return;
        }
        // The file's namesake stays, so the report lands on the intruder even
        // where it was declared first, as `SubmitLabel` was above `ProfileForm`.
        const keeper =
          declared.find((entry) => entry.name === namesake) ?? declared[0];
        for (const entry of declared) {
          if (entry === keeper) {
            continue;
          }
          context.report({
            message: `A file declares one component, exported or not. '${entry.name}' shares this file with '${keeper.name}'. Move '${entry.name}' to a file named after it.`,
            node: entry.statement,
          });
        }
      },
    };
  },
};

const TEST_NAME_RE = /^should\s+.+\s+when\s+/iu;

// A row name opening with a `%s` or `$field` placeholder gets its opening words
// from the table row, so no row value can make it match TEST_NAME_RE and this
// rule cannot read what the composed name says.
const ROW_PLACEHOLDER_LEAD_RE = /^[$%]/u;

const SKIP_METHODS = new Set(["skip", "todo"]);

const TABLE_METHODS = new Set(["each", "for"]);

// `it.each(table)(name, fn)` and `` it.each`table`(name, fn) `` hang the row's
// name and callback off an outer call, so the chain naming the case is inside
// that outer call's own callee.
const tableCallee = (callee) => {
  if (callee.type === "CallExpression") {
    return callee.callee;
  }
  if (callee.type === "TaggedTemplateExpression") {
    return callee.tag;
  }
  return null;
};

const tableChain = (callee) => {
  const inner = tableCallee(callee);
  if (
    inner !== null &&
    inner.type === "MemberExpression" &&
    TABLE_METHODS.has(inner.property.name)
  ) {
    return inner;
  }
  return null;
};

const isTestIdentifier = (name) => name === "it" || name === "test";

// Whether this callee reaches `it` or `test` through a chain that suppresses no
// case. Walking the chain rather than matching a fixed depth is what lets
// `it.concurrent.only` through to the root.
const isTestCallee = (callee) => {
  if (!callee) {
    return false;
  }
  let node = tableChain(callee) ?? callee;
  while (node !== null && node.type === "MemberExpression") {
    if (node.property && SKIP_METHODS.has(node.property.name)) {
      return false;
    }
    node = node.object;
  }
  return (
    node !== null && node.type === "Identifier" && isTestIdentifier(node.name)
  );
};

const testNamingFormat = {
  create(context) {
    return {
      CallExpression(node) {
        if (!isTestCallee(node.callee)) {
          return;
        }
        const [firstArg] = node.arguments;
        if (!firstArg) {
          return;
        }
        const testName =
          firstArg.type === "Literal" || firstArg.type === "StringLiteral"
            ? firstArg.value
            : null;
        if (typeof testName !== "string") {
          return;
        }
        if (TEST_NAME_RE.test(testName)) {
          return;
        }
        if (
          ROW_PLACEHOLDER_LEAD_RE.test(testName) &&
          tableChain(node.callee) !== null
        ) {
          return;
        }
        context.report({
          message: `Test name must follow the format: 'should [expected behavior] when [condition]'. Got: '${testName}'`,
          node,
        });
      },
    };
  },
};

const isExpectCall = (node) => {
  const { callee } = node;
  if (!callee) {
    return false;
  }
  if (callee.type === "Identifier" && callee.name === "expect") {
    return true;
  }
  if (callee.type === "MemberExpression" && callee.object?.name === "expect") {
    return true;
  }
  return false;
};

const declaresCase = (node) => {
  if (!isTestCallee(node.callee)) {
    return false;
  }
  const [, secondArg] = node.arguments;
  return (
    secondArg !== undefined &&
    (secondArg.type === "ArrowFunctionExpression" ||
      secondArg.type === "FunctionExpression")
  );
};

const singleExpect = {
  create(context) {
    const scopeStack = [];

    return {
      CallExpression(node) {
        if (declaresCase(node)) {
          scopeStack.push({ count: 0, testNode: node });
          return;
        }
        if (scopeStack.length > 0 && isExpectCall(node)) {
          const current = scopeStack.at(-1);
          current.count += 1;
        }
      },
      "CallExpression:exit"(node) {
        const scope = scopeStack.at(-1);
        if (scope?.testNode !== node) {
          return;
        }
        scopeStack.pop();
        if (scope.count > 1) {
          context.report({
            message: `Each test case should have exactly one expect(). Found ${scope.count} expect() calls.`,
            node: scope.testNode,
          });
        }
      },
    };
  },
};

const componentFileNaming = {
  create(context) {
    const filename = context.filename ?? context.getFilename?.();
    if (!filename) {
      return {};
    }

    const expectedName = expectedComponentName(filename);
    if (expectedName === null) {
      return {};
    }

    const checkComponentName = (name, node) => {
      if (name && isComponentName(name) && name !== expectedName) {
        context.report({
          message: `Component name '${name}' does not match file name. Expected '${expectedName}'.`,
          node,
        });
      }
    };

    return {
      ExportDefaultDeclaration(node) {
        const decl = node.declaration;
        if (!decl) {
          return;
        }
        if (
          (decl.type === "FunctionDeclaration" ||
            decl.type === "FunctionExpression") &&
          decl.id
        ) {
          checkComponentName(decl.id.name, node);
        }
      },
      ExportNamedDeclaration(node) {
        const decl = node.declaration;
        if (!decl) {
          return;
        }
        if (decl.type === "FunctionDeclaration" && decl.id) {
          checkComponentName(decl.id.name, node);
          return;
        }
        if (decl.type === "VariableDeclaration") {
          for (const declarator of decl.declarations) {
            const name =
              declarator.id?.type === "Identifier" ? declarator.id.name : null;
            if (!name || !isComponentName(name)) {
              continue;
            }
            const { init } = declarator;
            if (
              init &&
              (init.type === "ArrowFunctionExpression" ||
                init.type === "FunctionExpression")
            ) {
              checkComponentName(name, node);
            }
          }
        }
      },
    };
  },
};

// A file's layer is the innermost role directory on its path, so one entry
// reaches `src/shared/gateway/user/read.ts` and `src/routes/login/-gateway/read.ts`
// alike. The `-` spellings are the same directories inside `src/routes/`, where
// the prefix keeps the route generator from reading them as URL segments.
const ROLE_BY_SEGMENT = new Map([
  ["-components", "component"],
  ["-entities", "entity"],
  ["-gateway", "gateway"],
  ["components", "component"],
  ["entities", "entity"],
  ["gateway", "gateway"],
]);

const roleOf = (segments) =>
  ROLE_BY_SEGMENT.get(
    segments.findLast((segment) => ROLE_BY_SEGMENT.has(segment))
  ) ?? null;

/** Which layer a `src/`-relative path sits in, or `null` for none. */
const layerOf = (srcPath) => {
  const role = roleOf(srcPath.split("/"));
  if (role !== null) {
    return role;
  }
  // shadcn CLI output. `components.json` writes to this one path, so the
  // exception is anchored to it rather than to the segment name, which would
  // also take a `ui/` directory somewhere else out of its own layer.
  if (srcPath.startsWith("src/shared/ui/")) {
    return "component";
  }
  // The directory itself, because an import target can name it without a
  // trailing segment (`@/routes`) and that target sits in the layer too.
  if (srcPath === "src/lib" || srcPath.startsWith("src/lib/")) {
    return "adapter";
  }
  if (srcPath === "src/routes" || srcPath.startsWith("src/routes/")) {
    return "route";
  }
  return null;
};

// A route file and a component are both reached through the browser build, so
// they carry the same bans.
const BROWSER_PATH_BANS = [
  {
    message:
      "Routes and components must not touch persistence. src/lib/drizzle is owned by gateways.",
    target: "src/lib/drizzle",
  },
  {
    message:
      "Routes and components must not resolve request authentication. Delegate to a gateway.",
    target: "src/lib/auth/session",
  },
  {
    message:
      "Routes and components must not access Cloudflare persistence bindings directly. Delegate to a gateway.",
    target: "src/lib/cloudflare",
  },
];

const BROWSER_EXTERNAL_BANS = [
  {
    message:
      "Routes and components must not access Cloudflare bindings directly. Delegate to a gateway.",
    source: "cloudflare:workers",
  },
  {
    message:
      "Routes and components must not resolve request context directly. Delegate to a gateway.",
    source: "@tanstack/react-start/server",
  },
];

// What each layer may not import. `paths` names a target by where it sits,
// `layers` by what `layerOf` calls it, which is what reaches a role directory
// at any depth, and `externals` by its bare specifier.
const LAYER_RULES = {
  adapter: {
    layers: [
      {
        layer: "route",
        message:
          "Adapters must not import routes. src/lib is read by the layers above it.",
      },
      {
        layer: "gateway",
        message:
          "Adapters must not import gateways. A gateway reaches src/lib, never the reverse.",
      },
      { layer: "component", message: "Adapters never import components." },
    ],
  },
  component: {
    externals: BROWSER_EXTERNAL_BANS,
    paths: BROWSER_PATH_BANS,
  },
  entity: {
    layers: [
      {
        layer: "route",
        message:
          "Entities import nothing from the layers above. Routes are above entities.",
      },
      {
        layer: "gateway",
        message:
          "Entities import nothing from the layers above. Gateways are above entities.",
      },
      {
        layer: "component",
        message:
          "Entities import nothing from the layers above. A component reads entities, never the reverse.",
      },
    ],
    paths: [
      {
        message:
          "Entities import nothing from the layers above. A src/lib adapter reads entities, never the reverse.",
        target: "src/lib",
      },
    ],
  },
  gateway: {
    layers: [
      {
        layer: "route",
        message: "Gateways must not import routes. Imports flow downward only.",
      },
      { layer: "component", message: "Gateways never import components." },
    ],
  },
  route: {
    externals: BROWSER_EXTERNAL_BANS,
    paths: BROWSER_PATH_BANS,
  },
};

const SRC_MARKER = "/src/";

/** The file's path from `src/` down, or `null` when it sits outside `src/`. */
const srcPathOf = (context) => {
  const filename = context.filename ?? context.getFilename?.();
  if (!filename) {
    return null;
  }
  const srcIndex = filename.lastIndexOf(SRC_MARKER);
  if (srcIndex === -1) {
    return null;
  }
  return filename.slice(srcIndex + 1);
};

// `*.entry` は coverage 規約が付ける接尾辞で、付いていてもレイヤ上の位置は
// 変わらないので、ban の照合前に落とす。
const COVERAGE_NAME_SUFFIX = /\.entry$/u;

const resolveImportTarget = (fileSrcDir, specifier) => {
  if (specifier.startsWith("@/")) {
    return `src/${specifier.slice(2)}`.replace(COVERAGE_NAME_SUFFIX, "");
  }
  if (specifier.startsWith(".")) {
    return path.posix
      .join(fileSrcDir, specifier)
      .replace(COVERAGE_NAME_SUFFIX, "");
  }
  return null;
};

const PRIVATE_DIRECTORY_PREFIX = "-";

const ROUTES_ROOT = "src/routes";

/**
 * The directory that owns the first `-` directory on this path, or `null` when
 * the path holds none.
 *
 * The last segment is a module name rather than a directory, so a `-` file such
 * as `src/routes/api/-avatars.test.ts` owns nothing.
 */
const privateOwnerOf = (srcPath) => {
  const segments = srcPath.split("/");
  const index = segments
    .slice(0, -1)
    .findIndex((segment) => segment.startsWith(PRIVATE_DIRECTORY_PREFIX));
  return index === -1 ? null : segments.slice(0, index).join("/");
};

/**
 * Whether a module at `importerPath` may read one owned by `ownerPath`.
 *
 * A deeper owner is one route's directory, and every module under it shares
 * that route. `src/routes` is the URL space rather than a route, so its `-`
 * directories are read by the route files sitting directly in it (`__root.tsx`)
 * and by the modules inside a `-` directory at that level; `src/routes/login/
 * route.tsx` is a second route reaching in.
 */
const mayReadPrivate = (importerPath, ownerPath) => {
  if (!importerPath.startsWith(`${ownerPath}/`)) {
    return false;
  }
  if (ownerPath !== ROUTES_ROOT) {
    return true;
  }
  const rest = importerPath.slice(ownerPath.length + 1);
  return !rest.includes("/") || rest.startsWith(PRIVATE_DIRECTORY_PREFIX);
};

const layerBoundaries = {
  create(context) {
    const srcPath = srcPathOf(context);
    if (srcPath === null) {
      return {};
    }
    const fileSrcDir = srcPath.slice(0, srcPath.lastIndexOf("/"));

    const rules = LAYER_RULES[layerOf(srcPath)];
    if (rules === undefined) {
      return {};
    }

    const checkImportSource = (node) => {
      const { source } = node;
      if (!source || typeof source.value !== "string") {
        return;
      }
      const externalViolation = rules.externals?.find(
        (ban) => source.value === ban.source
      );
      if (externalViolation !== undefined) {
        context.report({ message: externalViolation.message, node });
        return;
      }
      const target = resolveImportTarget(fileSrcDir, source.value);
      if (target === null) {
        return;
      }
      const pathViolation = rules.paths?.find(
        (ban) => target === ban.target || target.startsWith(`${ban.target}/`)
      );
      if (pathViolation !== undefined) {
        context.report({ message: pathViolation.message, node });
        return;
      }
      const targetLayer = layerOf(target);
      const layerViolation = rules.layers?.find(
        (ban) => ban.layer === targetLayer
      );
      if (layerViolation !== undefined) {
        context.report({ message: layerViolation.message, node });
        return;
      }
      const owner = privateOwnerOf(target);
      if (owner !== null && !mayReadPrivate(srcPath, owner)) {
        const scope =
          owner === ROUTES_ROOT
            ? `the route files directly in \`${owner}/\``
            : `\`${owner}/\``;
        context.report({
          message: `A \`-\` directory is private to ${scope}. A second route reaching this module makes it shared, so move it to \`src/shared/\`.`,
          node,
        });
      }
    };

    return {
      ExportAllDeclaration: checkImportSource,
      ExportNamedDeclaration: checkImportSource,
      ImportDeclaration: checkImportSource,
      ImportExpression: checkImportSource,
    };
  },
};

const SERVER_ONLY_MARKER = "@tanstack/react-start/server-only";

/**
 * Which environment runs a module that `src/lib` holds, decided by the
 * directory it sits in. The longest matching prefix wins, so a browser
 * directory nested inside a server one stays a browser directory. A gateway is
 * decided by `layerOf` instead, in `classifyModule` below.
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
  {
    hint: "This directory hands out the Worker bindings, which exist on the server alone.",
    prefix: "src/lib/cloudflare/",
    runs: "server",
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

/**
 * A route file declares `Route` and imports the component it draws.
 *
 * `one-component-per-file` does not reach this: `export const Route =
 * createFileRoute(...)({...})` is a declarator whose init is a `CallExpression`,
 * so a route file holding one inline component counts one, not two.
 */
const routeImportsItsComponent = {
  create(context) {
    const srcPath = srcPathOf(context);
    if (
      srcPath === null ||
      layerOf(srcPath) !== "route" ||
      isTestStem(srcPath.replace(/\.(?:tsx?|jsx?)$/u, ""))
    ) {
      return {};
    }
    return {
      Program(node) {
        for (const statement of node.body) {
          for (const name of componentsDeclaredBy(statement)) {
            context.report({
              message: `A route file declares 'Route' and imports what it draws. Move '${name}' to a '-components/' directory beside this file and import it.`,
              node: statement,
            });
          }
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "arch-rules" },
  rules: {
    "component-file-naming": componentFileNaming,
    "layer-boundaries": layerBoundaries,
    "no-size-props": noSizeProps,
    "one-component-per-file": oneComponentPerFile,
    "route-imports-its-component": routeImportsItsComponent,
    "server-only-marker": serverOnlyMarker,
    "single-expect": singleExpect,
    "test-naming-format": testNamingFormat,
  },
};

export default plugin;
