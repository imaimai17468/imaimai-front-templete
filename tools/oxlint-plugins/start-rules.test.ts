import { describe, expect, it, vi } from "vite-plus/test";
import plugin from "./start-rules.js";

const makeContext = () => ({
  report: vi.fn<(descriptor: { message: string; node: unknown }) => void>(),
});

// The fixtures reach only as deep as the rule reads, so a callee is whichever
// of these shapes the case under test needs and nothing more.
interface Node {
  readonly type: string;
  readonly name?: string;
  readonly value?: string;
  readonly callee?: Node;
  readonly computed?: boolean;
  readonly expression?: Node;
  readonly object?: Node;
  readonly property?: Node;
  readonly arguments?: readonly Node[];
}

const identifier = (name: string): Node => ({ name, type: "Identifier" });

const member = (object: Node, property: Node): Node => ({
  computed: false,
  object,
  property,
  type: "MemberExpression",
});

/** `object[property]`, where the property is an expression rather than a name. */
const computedMember = (object: Node, property: Node): Node => ({
  computed: true,
  object,
  property,
  type: "MemberExpression",
});

/** The wrapper an optional-chaining expression arrives inside. */
const chain = (expression: Node): Node => ({
  expression,
  type: "ChainExpression",
});

const call = (callee: Node, args: readonly Node[] = []): Node => ({
  arguments: args,
  callee,
  type: "CallExpression",
});

/** `<callee>.<method>(<args>)`, the shape every chain link in the rule takes. */
const methodCall = (
  object: Node,
  method: string,
  args: readonly Node[] = []
): Node => call(member(object, identifier(method)), args);

interface Specifier {
  readonly type: string;
  readonly local: { readonly name: string };
  readonly imported?: { readonly name: string };
}

const named = (imported: string, local = imported): Specifier => ({
  imported: { name: imported },
  local: { name: local },
  type: "ImportSpecifier",
});

const namespace = (local: string): Specifier => ({
  local: { name: local },
  type: "ImportNamespaceSpecifier",
});

const defaultImport = (local: string): Specifier => ({
  local: { name: local },
  type: "ImportDefaultSpecifier",
});

const importFrom = (source: string, specifiers: readonly Specifier[]) => ({
  source: { value: source },
  specifiers,
});

const START = "@tanstack/react-start";

/** Feeds the rule one module: its imports, then its calls, then Program exit. */
const lintModule = (
  context: ReturnType<typeof makeContext>,
  module: {
    readonly imports?: readonly ReturnType<typeof importFrom>[];
    readonly calls: readonly Node[];
  }
) => {
  const visitors =
    plugin.rules["no-rewritten-factory-in-handler"].create(context);
  for (const node of module.imports ?? []) {
    visitors.ImportDeclaration(node);
  }
  for (const node of module.calls) {
    visitors.CallExpression(node);
  }
  visitors["Program:exit"]();
};

const startImports = [
  importFrom(START, [
    named("createServerFn"),
    named("createServerOnlyFn"),
    named("createClientOnlyFn"),
    named("createIsomorphicFn"),
  ]),
];

/** `createServerFn({ method }).handler(<argument>)`. */
const serverFnHandler = (argument: Node, serverFnName = "createServerFn") =>
  methodCall(call(identifier(serverFnName)), "handler", [argument]);

describe("no-rewritten-factory-in-handler", () => {
  it("should report with the factory name and the fix when the handler argument is a createServerOnlyFn call", () => {
    const context = makeContext();
    const argument = call(identifier("createServerOnlyFn"), [
      identifier("impl"),
    ]);
    lintModule(context, {
      calls: [serverFnHandler(argument)],
      imports: startImports,
    });
    expect(context.report.mock.calls).toStrictEqual([
      [
        {
          message:
            "The Start compiler replaces this argument with an RPC stub, then rewrites that stub again as the createServerOnlyFn call, so the deployed .handler() no longer performs the server call. Assign the createServerOnlyFn call to a module-scope const and pass that const to .handler().",
          node: argument,
        },
      ],
    ]);
  });

  it("should report when the handler argument is a createClientOnlyFn call", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [
        serverFnHandler(
          call(identifier("createClientOnlyFn"), [identifier("impl")])
        ),
      ],
      imports: startImports,
    });
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when the handler argument is a createIsomorphicFn chain", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [
        serverFnHandler(
          methodCall(
            methodCall(call(identifier("createIsomorphicFn")), "server", [
              identifier("onServer"),
            ]),
            "client",
            [identifier("onClient")]
          )
        ),
      ],
      imports: startImports,
    });
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when the factory reaches the file under a renamed import", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [
        serverFnHandler(
          call(identifier("serverOnly"), [identifier("impl")]),
          "makeServerFn"
        ),
      ],
      imports: [
        importFrom(START, [
          named("createServerFn", "makeServerFn"),
          named("createServerOnlyFn", "serverOnly"),
        ]),
      ],
    });
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when both calls come off a namespace import", () => {
    const context = makeContext();
    const factory = member(
      identifier("Start"),
      identifier("createServerOnlyFn")
    );
    lintModule(context, {
      calls: [
        methodCall(
          call(member(identifier("Start"), identifier("createServerFn"))),
          "handler",
          [call(factory, [identifier("impl")])]
        ),
      ],
      imports: [importFrom(START, [namespace("Start")])],
    });
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should stay silent when the handler argument is an identifier", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [serverFnHandler(identifier("getCurrentUser"))],
      imports: startImports,
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the handler takes no argument", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [methodCall(call(identifier("createServerFn")), "handler")],
      imports: startImports,
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the handler argument calls an ordinary factory", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [serverFnHandler(call(identifier("makeHandler")))],
      imports: startImports,
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the chain does not start at createServerFn", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [
        methodCall(call(identifier("createRouteBuilder")), "handler", [
          call(identifier("createServerOnlyFn"), [identifier("impl")]),
        ]),
      ],
      imports: startImports,
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the chain root is an identifier rather than a call", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [
        methodCall(identifier("builder"), "handler", [
          call(identifier("createServerOnlyFn"), [identifier("impl")]),
        ]),
      ],
      imports: startImports,
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the factory name is not imported at all", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [
        serverFnHandler(
          call(identifier("createServerOnlyFn"), [identifier("impl")])
        ),
      ],
      imports: [importFrom(START, [named("createServerFn")])],
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the factory names come from another package", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [
        serverFnHandler(
          call(identifier("createServerOnlyFn"), [identifier("impl")])
        ),
      ],
      imports: [
        importFrom("./local-start-lookalike", [
          named("createServerFn"),
          named("createServerOnlyFn"),
        ]),
      ],
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the module has no imports at all", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [
        serverFnHandler(
          call(identifier("createServerOnlyFn"), [identifier("impl")])
        ),
      ],
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the only Start specifier is a default import", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [
        serverFnHandler(
          call(identifier("createServerOnlyFn"), [identifier("impl")])
        ),
      ],
      imports: [importFrom(START, [defaultImport("Start")])],
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the called method is not handler", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [
        methodCall(call(identifier("createServerFn")), "validator", [
          call(identifier("createServerOnlyFn"), [identifier("impl")]),
        ]),
      ],
      imports: startImports,
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when handler is reached through a computed member", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [
        call(
          computedMember(
            call(identifier("createServerFn")),
            identifier("handler")
          ),
          [call(identifier("createServerOnlyFn"), [identifier("impl")])]
        ),
      ],
      imports: startImports,
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the call has no member callee", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [call(identifier("handler"), [call(identifier("makeHandler"))])],
      imports: startImports,
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the factory is a property of a plain object", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [
        serverFnHandler(
          call(
            member(identifier("helpers"), identifier("createServerOnlyFn")),
            [identifier("impl")]
          )
        ),
      ],
      imports: startImports,
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the factory is reached through a nested member chain", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [
        serverFnHandler(
          call(
            member(
              member(identifier("a"), identifier("b")),
              identifier("createServerOnlyFn")
            ),
            [identifier("impl")]
          )
        ),
      ],
      imports: startImports,
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when a namespace member is reached computed", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [
        methodCall(
          call(member(identifier("Start"), identifier("createServerFn"))),
          "handler",
          [
            call(
              computedMember(
                identifier("Start"),
                identifier("createServerOnlyFn")
              ),
              [identifier("impl")]
            ),
          ]
        ),
      ],
      imports: [importFrom(START, [namespace("Start")])],
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the handler argument is an immediately invoked call", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [serverFnHandler(call(call(identifier("makeFactory"))))],
      imports: startImports,
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the handler argument calls another Start export", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [serverFnHandler(call(identifier("createMiddleware")))],
      imports: [
        importFrom(START, [named("createServerFn"), named("createMiddleware")]),
      ],
    });
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when the factory chain reaches handler through optional chaining", () => {
    const context = makeContext();
    lintModule(context, {
      calls: [
        serverFnHandler(
          chain(
            methodCall(call(identifier("createIsomorphicFn")), "server", [
              identifier("onServer"),
            ])
          )
        ),
      ],
      imports: startImports,
    });
    expect(context.report).toHaveBeenCalledOnce();
  });
});
