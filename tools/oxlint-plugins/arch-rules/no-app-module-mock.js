const MOCK_METHODS = new Set(["mock", "doMock"]);

const APP_MODULE_RE = /^(?:\.{1,2}\/|@\/)/u;

/** The literal value a `vi.mock(...)` or `vi.doMock(...)` call passes, or null. */
const mockedLiteralValue = (node) => {
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
  return source?.type === "Literal" ? source.value : null;
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
        const mockedValue = mockedLiteralValue(node);
        // A value that is not a string, such as `1` or `null`, reads as its
        // string form here, and none of those opens with `./`, `../` or `@/`.
        if (APP_MODULE_RE.test(mockedValue)) {
          context.report({
            message: `'${mockedValue}' is an app module, and test files share a worker's module cache (isolate: false), so this mock does nothing once another file has loaded it. Pass the dependency in as an argument instead.`,
            node,
          });
        }
      },
    };
  },
};

export default noAppModuleMock;
