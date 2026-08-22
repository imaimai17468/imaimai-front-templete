const noSizeProps = {
  create(context) {
    return {
      JSXAttribute(node) {
        const propName = node.name && node.name.name;
        if (propName !== "width" && propName !== "height") return;
        const openingElement = node.parent;
        if (!openingElement) return;
        const elementName = openingElement.name;
        if (elementName.type === "JSXMemberExpression") {
          context.report({
            message: `Do not pass '${propName}' prop to components. Control size externally via the parent's CSS layout.`,
            node,
          });
          return;
        }
        if (elementName.type === "JSXIdentifier") {
          const firstChar = elementName.name[0];
          if (
            firstChar === firstChar.toUpperCase() &&
            firstChar !== firstChar.toLowerCase()
          ) {
            context.report({
              message: `Do not pass '${propName}' prop to components. Control size externally via the parent's CSS layout.`,
              node,
            });
          }
        }
      },
    };
  },
};

const isComponentName = (name) =>
  typeof name === "string" &&
  name[0] === name[0].toUpperCase() &&
  name[0] !== name[0].toLowerCase();

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
      ExportNamedDeclaration(node) {
        const decl = node.declaration;
        if (!decl) return;
        if (decl.type === "FunctionDeclaration") {
          if (decl.id && isComponentName(decl.id.name)) {
            reportIfSecond(node);
          }
          return;
        }
        if (decl.type === "VariableDeclaration") {
          decl.declarations.forEach((declarator) => {
            const name =
              declarator.id && declarator.id.type === "Identifier"
                ? declarator.id.name
                : null;
            if (!name || !isComponentName(name)) return;
            const init = declarator.init;
            if (
              init &&
              (init.type === "ArrowFunctionExpression" ||
                init.type === "FunctionExpression")
            ) {
              reportIfSecond(node);
            }
          });
        }
      },
      ExportDefaultDeclaration(node) {
        const decl = node.declaration;
        if (!decl) return;
        if (
          (decl.type === "FunctionDeclaration" ||
            decl.type === "FunctionExpression") &&
          decl.id &&
          isComponentName(decl.id.name)
        ) {
          reportIfSecond(node);
        }
      },
    };
  },
};

const TEST_NAME_RE = /^should\s+.+\s+when\s+/i;

const SKIP_METHODS = new Set(["each", "skip", "todo"]);

const testNamingFormat = {
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        let calleeName = null;
        if (callee.type === "Identifier") {
          calleeName = callee.name;
        } else if (
          callee.type === "MemberExpression" &&
          callee.object &&
          callee.object.type === "Identifier" &&
          (callee.object.name === "it" || callee.object.name === "test")
        ) {
          if (callee.property && SKIP_METHODS.has(callee.property.name)) {
            return;
          }
          calleeName = callee.object.name;
        }
        if (calleeName !== "it" && calleeName !== "test") return;
        const firstArg = node.arguments[0];
        if (!firstArg) return;
        const testName =
          firstArg.type === "Literal" || firstArg.type === "StringLiteral"
            ? firstArg.value
            : null;
        if (typeof testName !== "string") return;
        if (!TEST_NAME_RE.test(testName)) {
          context.report({
            message: `Test name must follow the format: 'should [expected behavior] when [condition]'. Got: '${testName}'`,
            node,
          });
        }
      },
    };
  },
};

const isExpectCall = (node) => {
  const callee = node.callee;
  if (!callee) return false;
  if (callee.type === "Identifier" && callee.name === "expect") return true;
  if (
    callee.type === "MemberExpression" &&
    callee.object &&
    callee.object.name === "expect"
  )
    return true;
  return false;
};

const isEachCall = (node) => {
  const callee = node.callee;
  if (!callee) return false;
  if (
    callee.type === "MemberExpression" &&
    callee.object &&
    (callee.object.name === "it" || callee.object.name === "test") &&
    callee.property &&
    callee.property.name === "each"
  )
    return true;
  return false;
};

const singleExpect = {
  create(context) {
    const scopeStack = [];

    return {
      CallExpression(node) {
        if (isEachCall(node)) return;
        const callee = node.callee;
        let calleeName =
          callee && callee.type === "Identifier" ? callee.name : null;
        if (
          calleeName === null &&
          callee &&
          callee.type === "MemberExpression" &&
          callee.object &&
          callee.object.type === "Identifier" &&
          (callee.object.name === "it" || callee.object.name === "test")
        ) {
          if (callee.property && SKIP_METHODS.has(callee.property.name)) {
            return;
          }
          calleeName = callee.object.name;
        }
        if (calleeName === "it" || calleeName === "test") {
          const secondArg = node.arguments[1];
          if (
            secondArg &&
            (secondArg.type === "ArrowFunctionExpression" ||
              secondArg.type === "FunctionExpression")
          ) {
            scopeStack.push({ testNode: node, count: 0 });
          }
          return;
        }
        if (scopeStack.length > 0 && isExpectCall(node)) {
          const current = scopeStack[scopeStack.length - 1];
          current.count += 1;
        }
      },
      "CallExpression:exit"(node) {
        if (isEachCall(node)) return;
        const callee = node.callee;
        let calleeName =
          callee && callee.type === "Identifier" ? callee.name : null;
        if (
          calleeName === null &&
          callee &&
          callee.type === "MemberExpression" &&
          callee.object &&
          callee.object.type === "Identifier" &&
          (callee.object.name === "it" || callee.object.name === "test")
        ) {
          if (callee.property && SKIP_METHODS.has(callee.property.name)) {
            return;
          }
          calleeName = callee.object.name;
        }
        if (calleeName !== "it" && calleeName !== "test") return;
        const secondArg = node.arguments[1];
        if (
          !secondArg ||
          (secondArg.type !== "ArrowFunctionExpression" &&
            secondArg.type !== "FunctionExpression")
        )
          return;
        if (scopeStack.length === 0) return;
        const scope = scopeStack.pop();
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
    if (!filename) return {};

    const basename = filename.slice(filename.lastIndexOf("/") + 1);
    const withoutExt = basename.replace(/\.(tsx?|jsx?)$/, "");

    if (
      withoutExt === "" ||
      SKIP_STEMS.has(withoutExt) ||
      withoutExt.endsWith(".test") ||
      withoutExt.endsWith(".spec")
    )
      return {};

    const expectedName = withoutExt
      .split(".")
      .map((s) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)))
      .join("");

    if (!isComponentName(expectedName)) return {};

    const checkComponentName = (name, node) => {
      if (name && isComponentName(name) && name !== expectedName) {
        context.report({
          message: `Component name '${name}' does not match file name. Expected '${expectedName}'.`,
          node,
        });
      }
    };

    return {
      ExportNamedDeclaration(node) {
        const decl = node.declaration;
        if (!decl) return;
        if (decl.type === "FunctionDeclaration" && decl.id) {
          checkComponentName(decl.id.name, node);
          return;
        }
        if (decl.type === "VariableDeclaration") {
          decl.declarations.forEach((declarator) => {
            const name =
              declarator.id && declarator.id.type === "Identifier"
                ? declarator.id.name
                : null;
            if (!name || !isComponentName(name)) return;
            const init = declarator.init;
            if (
              init &&
              (init.type === "ArrowFunctionExpression" ||
                init.type === "FunctionExpression")
            ) {
              checkComponentName(name, node);
            }
          });
        }
      },
      ExportDefaultDeclaration(node) {
        const decl = node.declaration;
        if (!decl) return;
        if (
          (decl.type === "FunctionDeclaration" ||
            decl.type === "FunctionExpression") &&
          decl.id
        ) {
          checkComponentName(decl.id.name, node);
        }
      },
    };
  },
};

// Layer contract: components + routes → client → server/router → gateways → entities,
// imports flow downward only. `client` is the UI's single door to data access, so
// components reach the server boundary through it and never past it. `lib` outside
// the binding-touching modules stays unrestricted; the banned ones are listed per
// layer below rather than counted here.
const LAYER_BANS = [
  {
    layer: "src/components",
    externalBans: [
      {
        source: "cloudflare:workers",
        message:
          "Components must not access Cloudflare bindings — data access belongs in src/client.",
      },
      {
        source: "@tanstack/react-start/server",
        message:
          "Components must not resolve server request context — data access belongs in src/client.",
      },
    ],
    bans: [
      {
        target: "src/server",
        message:
          "Components must not call server procedures directly — go through src/client.",
      },
      {
        target: "src/gateways",
        message: "Components must not import gateways — go through src/client.",
      },
      {
        target: "src/lib/drizzle",
        message:
          "Components must not touch persistence — src/lib/drizzle is owned by gateways.",
      },
      {
        target: "src/lib/storage/r2",
        message:
          "Components must not touch object storage — src/lib/storage/r2 is owned by gateways.",
      },
      {
        target: "src/lib/auth/session",
        message:
          "Components must not resolve request authentication — go through src/client.",
      },
      {
        target: "src/lib/auth/auth",
        message:
          "Components must not touch the raw Better Auth instance — src/lib/auth/auth reaches persistence and Cloudflare bindings directly; go through src/client.",
      },
    ],
  },
  {
    layer: "src/client",
    externalBans: [
      {
        source: "cloudflare:workers",
        message:
          "src/client also runs in the browser — it must not access Cloudflare bindings.",
      },
      {
        source: "@tanstack/react-start/server",
        message:
          "src/client also runs in the browser — it must not resolve server request context.",
      },
    ],
    bans: [
      {
        target: "src/gateways",
        message:
          "src/client must not import gateways — cross the boundary through a server procedure.",
      },
      {
        target: "src/lib/drizzle",
        message:
          "src/client must not touch persistence — src/lib/drizzle is owned by gateways.",
      },
      {
        target: "src/lib/storage/r2",
        message:
          "src/client must not touch object storage — src/lib/storage/r2 is owned by gateways.",
      },
      {
        target: "src/lib/auth/session",
        message:
          "src/client must not resolve request authentication — that is the server boundary's job.",
      },
      {
        target: "src/lib/auth/auth",
        message:
          "src/client must not touch the raw Better Auth instance — src/lib/auth/auth reaches persistence and Cloudflare bindings directly.",
      },
    ],
  },
  {
    layer: "src/routes",
    externalBans: [
      {
        source: "cloudflare:workers",
        message:
          "Routes must not access Cloudflare bindings directly — delegate through src/server/router to a gateway.",
      },
      {
        source: "@tanstack/react-start/server",
        message:
          "Routes must not resolve request context directly — delegate to src/server/router.",
      },
    ],
    bans: [
      {
        target: "src/gateways",
        message:
          "Routes must not import gateways directly — go through a procedure in src/server/router.",
      },
      {
        target: "src/lib/drizzle",
        message:
          "Routes must not touch persistence — src/lib/drizzle is owned by gateways.",
      },
      {
        target: "src/lib/auth/session",
        message:
          "Routes must not resolve request authentication — delegate to src/server/router.",
      },
      {
        target: "src/server/cloudflare",
        message:
          "Routes must not access Cloudflare persistence bindings directly — delegate through src/server/router to a gateway.",
      },
      {
        target: "src/server/router",
        message:
          "Routes must not call server procedures — a browser-facing route reaches data through src/client, and an HTTP endpoint belongs in the Hono app at src/server/app.",
      },
      {
        target: "src/server/handlers",
        message:
          "Routes must not call HTTP handlers directly — register them on the Hono app at src/server/app.",
      },
    ],
  },
  {
    layer: "src/server/router",
    bans: [
      {
        target: "src/routes",
        message:
          "Procedures must not import routes — imports flow downward only.",
      },
    ],
  },
  {
    layer: "src/gateways",
    bans: [
      {
        target: "src/routes",
        message:
          "Gateways must not import routes — imports flow downward only.",
      },
      {
        target: "src/server/router",
        message:
          "Gateways must not import procedures — imports flow downward only.",
      },
      {
        target: "src/components",
        message: "Gateways never import components.",
      },
      {
        target: "src/lib/auth",
        message:
          "Gateways must not resolve request authentication — derive identity in src/server/router and pass it downward.",
      },
    ],
  },
  {
    layer: "src/entities",
    bans: [
      {
        target: "src/routes",
        message:
          "Entities import nothing from the layers above — routes are above entities.",
      },
      {
        target: "src/server/router",
        message:
          "Entities import nothing from the layers above — procedures are above entities.",
      },
      {
        target: "src/gateways",
        message:
          "Entities import nothing from the layers above — gateways are above entities.",
      },
    ],
  },
];

// Default-deny for the modules that reach a binding or a session. LAYER_BANS
// enumerates who may not import what, so every new layer starts unrestricted and
// has to be added by hand. These entries invert that: anything not listed as an
// allowed importer is refused, so a directory added later is denied by default.
// The two layers that resolve a session per call. Shared so the allow-list below
// and the module-scope-state rule cannot drift apart.
const IDENTITY_LAYERS = ["src/server/router", "src/server/handlers"];

const PROTECTED_TARGETS = [
  {
    target: "src/gateways",
    allowed: ["src/server/router", "src/server/handlers"],
    message:
      "Only procedures and HTTP handlers may reach a gateway — everything else goes through src/client.",
  },
  {
    target: "src/lib/drizzle",
    allowed: ["src/gateways", "src/lib/auth/auth"],
    message: "Persistence is owned by gateways and the auth adapter.",
  },
  {
    target: "src/lib/storage/r2",
    allowed: ["src/gateways"],
    message: "Object storage is owned by gateways.",
  },
  {
    target: "src/lib/auth/session",
    allowed: IDENTITY_LAYERS,
    message:
      "Only procedures and HTTP handlers may resolve a session — identity flows downward as an argument.",
  },
  {
    target: "src/lib/auth/auth",
    allowed: ["src/server/app", "src/lib/auth"],
    message:
      "The raw Better Auth instance reaches persistence and bindings — mount it in the Hono app instead.",
  },
  {
    target: "src/server/cloudflare",
    allowed: [
      "src/lib/drizzle",
      "src/lib/storage/r2",
      "src/lib/auth/auth",
      "src/gateways",
    ],
    message:
      "Cloudflare bindings are read by the infrastructure adapters and gateways only.",
  },
];

const PROTECTED_EXTERNALS = [
  {
    source: "cloudflare:workers",
    allowed: ["src/server/cloudflare"],
    message:
      "cloudflare:workers is read in one place — import from src/server/cloudflare instead.",
  },
];

// `path` is either a real filename (carries `.ts`) or a resolved import
// specifier (never does), so both forms have to match a single-file target.
// One predicate serves both a file target and a directory prefix, so a file
// named src/lib/auth.ts beside src/lib/auth/ would satisfy the directory entry
// too. Left as-is: that pair also makes `@/lib/auth` ambiguous to module
// resolution, so the collision cannot arrive quietly.
const isUnder = (path, dir) =>
  path === dir || path === `${dir}.ts` || path.startsWith(`${dir}/`);

const SRC_MARKER = "/src/";

const resolveImportTarget = (fileSrcDir, specifier) => {
  if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
  if (specifier.startsWith(".")) {
    const parts = fileSrcDir.split("/");
    specifier.split("/").forEach((segment) => {
      if (segment === ".") return;
      if (segment === "..") parts.pop();
      else parts.push(segment);
    });
    return parts.join("/");
  }
  return null;
};

const layerBoundaries = {
  create(context) {
    const filename = context.filename ?? context.getFilename?.();
    if (!filename) return {};

    const srcIndex = filename.lastIndexOf(SRC_MARKER);
    if (srcIndex === -1) return {};
    const srcPath = filename.slice(srcIndex + 1);
    const fileSrcDir = srcPath.slice(0, srcPath.lastIndexOf("/"));

    // No early return when the file is outside every LAYER_BANS layer: the
    // PROTECTED_TARGETS guards below are the default-deny half of this rule and
    // exist precisely to cover directories nobody registered.
    const layerEntry = LAYER_BANS.find((entry) =>
      srcPath.startsWith(`${entry.layer}/`)
    );

    const checkImportSource = (node) => {
      const source = node.source;
      if (!source || typeof source.value !== "string") return;
      const target = resolveImportTarget(fileSrcDir, source.value);

      // Layer-specific bans first: they carry the message that names the layer
      // and what it should do instead. The default-deny guards below are the
      // fallback for what no layer covers, so running them first would shadow
      // every tailored message with a generic one.
      if (layerEntry !== undefined) {
        const externalViolation = layerEntry.externalBans?.find(
          (ban) => source.value === ban.source
        );
        if (externalViolation !== undefined) {
          context.report({ message: externalViolation.message, node });
          return;
        }
        const violated =
          target === null
            ? undefined
            : layerEntry.bans.find(
                (ban) =>
                  target === ban.target || target.startsWith(`${ban.target}/`)
              );
        if (violated !== undefined) {
          context.report({ message: violated.message, node });
          return;
        }
      }

      const externalGuard = PROTECTED_EXTERNALS.find(
        (guard) => source.value === guard.source
      );
      if (
        externalGuard !== undefined &&
        !externalGuard.allowed.some((dir) => isUnder(srcPath, dir))
      ) {
        context.report({ message: externalGuard.message, node });
        return;
      }
      const protectedTarget =
        target === null
          ? undefined
          : PROTECTED_TARGETS.find((guard) => isUnder(target, guard.target));
      // A module's own directory is exempt only when that directory is itself
      // named in the target's `allowed` list — as `src/lib/auth` is for the
      // `src/lib/auth/auth` target, because session.ts needs it in production.
      // A target whose allow-list names only its consumer layers, like
      // `src/lib/auth/session`, has no such exemption for a same-directory test.
      if (
        protectedTarget !== undefined &&
        !isUnder(srcPath, protectedTarget.target) &&
        !protectedTarget.allowed.some((dir) => isUnder(srcPath, dir))
      ) {
        context.report({ message: protectedTarget.message, node });
      }
    };

    return {
      ImportDeclaration: checkImportSource,
      ImportExpression: checkImportSource,
      ExportNamedDeclaration: checkImportSource,
      ExportAllDeclaration: checkImportSource,
    };
  },
};

// Identity is bound per call in this layer, so a module-scope binding that can
// be reassigned is a place a resolved user could survive into the next request.
// Scoped to the layer rather than a file list: a procedure added later is covered
// without being named. The resolver itself sits in src/lib/auth beside a
// legitimate per-isolate cache, so lint cannot cover it — the concurrency test in
// src/server/router/middleware.test.ts carries that half.

const CACHE_CONSTRUCTORS = new Set(["Map", "Set", "WeakMap", "WeakSet"]);

// A `const` binding is still a cache when it holds one of these. A `const`
// holding a plain object or array mutated in place is a known residual gap:
// src/server/router/index.ts composes the router as exactly that shape, so a
// blanket ban on module-scope objects would report real, correct code. A
// namespaced or aliased constructor (`new globalThis.Map()`, an imported alias)
// escapes too — matching by identifier name was chosen over resolving aliases.
const holdsMutableCache = (node) =>
  (node.declarations ?? []).some(
    (declarator) =>
      declarator.init?.type === "NewExpression" &&
      CACHE_CONSTRUCTORS.has(declarator.init.callee?.name)
  );

const noModuleScopeState = {
  create(context) {
    const filename = context.filename ?? context.getFilename?.();
    if (!filename) return {};
    const srcIndex = filename.lastIndexOf(SRC_MARKER);
    if (srcIndex === -1) return {};
    const srcPath = filename.slice(srcIndex + 1);
    if (!IDENTITY_LAYERS.some((layer) => isUnder(srcPath, layer))) return {};

    return {
      VariableDeclaration: (node) => {
        const parentType = node.parent?.type;
        if (
          parentType !== "Program" &&
          parentType !== "ExportNamedDeclaration"
        ) {
          return;
        }
        if (node.kind === "const" && !holdsMutableCache(node)) return;
        context.report({
          message:
            "No module-scope cache where identity is resolved — it is bound per call, and a module-scope binding would outlive the request that produced it.",
          node,
        });
      },
    };
  },
};

const plugin = {
  meta: { name: "arch-rules" },
  rules: {
    "no-size-props": noSizeProps,
    "one-component-per-file": oneComponentPerFile,
    "component-file-naming": componentFileNaming,
    "test-naming-format": testNamingFormat,
    "single-expect": singleExpect,
    "layer-boundaries": layerBoundaries,
    "no-module-scope-state": noModuleScopeState,
  },
};

export default plugin;
