const START_PACKAGE = "@tanstack/react-start";

const SERVER_FN_FACTORY = "createServerFn";

/**
 * The names `@tanstack/react-start` exports whose calls the Start compiler
 * rewrites through a Babel path it captured before `handleCreateServerFn`
 * replaced the handler argument with an RPC stub. The second rewrite then
 * lands on the stub.
 */
const REWRITTEN_FACTORIES = new Set([
  "createServerOnlyFn",
  "createClientOnlyFn",
  "createIsomorphicFn",
]);

/** `a()?.b()` reaches the rule wrapped, and the call inside is what it reads. */
const unwrapChain = (node) =>
  node.type === "ChainExpression" ? unwrapChain(node.expression) : node;

/** Walks a `a().b().c()` chain down to the call that starts it. */
const rootCallOf = (node) => {
  let current = node;
  while (
    current.callee.type === "MemberExpression" &&
    current.callee.object.type === "CallExpression"
  ) {
    current = current.callee.object;
  }
  return current;
};

/**
 * Resolves a callee that is a `@tanstack/react-start` import itself. A const
 * bound to one, and a name re-exported by another module, both read as
 * unresolved, which leaves the rule silent rather than wrong.
 */
const createDirectImportResolver = () => {
  const namedImports = new Map();
  const namespaceImports = new Set();

  const record = (node) => {
    if (node.source.value !== START_PACKAGE) {
      return;
    }
    for (const specifier of node.specifiers) {
      if (specifier.type === "ImportSpecifier") {
        namedImports.set(specifier.local.name, specifier.imported.name);
      } else if (specifier.type === "ImportNamespaceSpecifier") {
        namespaceImports.add(specifier.local.name);
      }
    }
  };

  /** The name `@tanstack/react-start` exports this callee under, or null. */
  const resolve = (callee) => {
    if (callee.type === "Identifier") {
      return namedImports.get(callee.name) ?? null;
    }
    if (
      callee.type === "MemberExpression" &&
      !callee.computed &&
      callee.object.type === "Identifier" &&
      namespaceImports.has(callee.object.name)
    ) {
      return callee.property.name;
    }
    return null;
  };

  return { record, resolve };
};

const noRewrittenFactoryInHandler = {
  create(context) {
    const imports = createDirectImportResolver();
    const handlerCalls = [];

    return {
      CallExpression(node) {
        if (
          node.callee.type !== "MemberExpression" ||
          node.callee.computed ||
          node.callee.property.name !== "handler"
        ) {
          return;
        }
        const [passed] = node.arguments;
        if (passed === undefined) {
          return;
        }
        const argument = unwrapChain(passed);
        if (argument.type !== "CallExpression") {
          return;
        }
        handlerCalls.push({ argument, node });
      },

      ImportDeclaration: imports.record,

      // Reporting waits for the whole module because an import declaration may
      // sit below the call that uses what it binds.
      "Program:exit"() {
        for (const { argument, node } of handlerCalls) {
          if (imports.resolve(rootCallOf(node).callee) !== SERVER_FN_FACTORY) {
            continue;
          }
          const factory = imports.resolve(rootCallOf(argument).callee);
          if (!REWRITTEN_FACTORIES.has(factory)) {
            continue;
          }
          context.report({
            message: `The Start compiler replaces this argument with an RPC stub, then rewrites that stub again as the ${factory} call, so the deployed .handler() no longer performs the server call. Assign the ${factory} call to a module-scope const and pass that const to .handler().`,
            node: argument,
          });
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "start-rules" },
  rules: {
    "no-rewritten-factory-in-handler": noRewrittenFactoryInHandler,
  },
};

export default plugin;
