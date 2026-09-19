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

const oneComponentPerFile = {
  create(context) {
    const exportedComponents = [];

    const reportIfSecond = (node) => {
      exportedComponents.push(node);
      if (exportedComponents.length > 1) {
        context.report({
          message:
            "Only one component may be exported per file. Found multiple exported components.",
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
          decl.id &&
          isComponentName(decl.id.name)
        ) {
          reportIfSecond(node);
        }
      },
      ExportNamedDeclaration(node) {
        const decl = node.declaration;
        if (!decl) {
          return;
        }
        if (decl.type === "FunctionDeclaration") {
          if (decl.id && isComponentName(decl.id.name)) {
            reportIfSecond(node);
          }
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
              reportIfSecond(node);
            }
          }
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

const SKIP_STEMS = new Set(["index"]);

const componentFileNaming = {
  create(context) {
    const filename = context.filename ?? context.getFilename?.();
    if (!filename) {
      return {};
    }

    const basename = filename.slice(filename.lastIndexOf("/") + 1);
    const withoutExt = basename.replace(/\.(?:tsx?|jsx?)$/u, "");

    if (
      withoutExt === "" ||
      SKIP_STEMS.has(withoutExt) ||
      withoutExt.endsWith(".test") ||
      withoutExt.endsWith(".spec")
    ) {
      return {};
    }

    const expectedName = withoutExt
      .split(/[.-]/u)
      .map((s) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)))
      .join("");

    if (!isComponentName(expectedName)) {
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
  // shadcn CLI output, which `components.json` addresses by this name rather
  // than by sitting under `components/`.
  ["ui", "component"],
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
  if (srcPath.startsWith("src/lib/")) {
    return "adapter";
  }
  if (srcPath.startsWith("src/routes/")) {
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

const plugin = {
  meta: { name: "arch-rules" },
  rules: {
    "component-file-naming": componentFileNaming,
    "layer-boundaries": layerBoundaries,
    "no-size-props": noSizeProps,
    "one-component-per-file": oneComponentPerFile,
    "server-only-marker": serverOnlyMarker,
    "single-expect": singleExpect,
    "test-naming-format": testNamingFormat,
  },
};

export default plugin;
