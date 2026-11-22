const MOCK_METHODS = new Set(["mock", "doMock"]);

const APP_MODULE_RE = /^(?:\.{1,2}\/|@\/)/u;

/** The module a `vi.mock(...)` or `vi.doMock(...)` call names, or null. */
const mockedSpecifier = (node) => {
  const { callee } = node;
  if (
    callee.type !== "MemberExpression" ||
    callee.object.name !== "vi" ||
    !MOCK_METHODS.has(callee.property.name)
  ) {
    return null;
  }
  const [target] = node.arguments;
  const source = target?.type === "ImportExpression" ? target.source : target;
  return source?.type === "Literal" && typeof source.value === "string"
    ? source.value
    : null;
};

/**
 * Test files share a worker's module cache, so a module another file in the
 * worker loaded first stays the real one, and the mock silently does nothing.
 * A package such as `react-grab` stays mockable, because only the app's own
 * modules are reported.
 */
const noAppModuleMock = {
  create(context) {
    return {
      CallExpression(node) {
        const specifier = mockedSpecifier(node);
        if (specifier !== null && APP_MODULE_RE.test(specifier)) {
          context.report({
            message: `'${specifier}' is an app module, and test files share a worker's module cache (isolate: false), so this mock does nothing once another file has loaded it. Pass the dependency in as an argument instead.`,
            node,
          });
        }
      },
    };
  },
};

export default noAppModuleMock;
