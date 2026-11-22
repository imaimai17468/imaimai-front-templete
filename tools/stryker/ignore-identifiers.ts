import type { NodePath } from "@babel/core";
import { types } from "@babel/core";
import { PluginKind, declareValuePlugin } from "@stryker-mutator/api/plugin";

export const IGNORER_NAME = "identifiers";

interface NamingSite {
  readonly call: types.CallExpression;
  readonly callParent: types.Node;
}

interface IdentifierKind {
  readonly matches: (site: NamingSite) => boolean;
  readonly reason: string;
}

const isMemberNamed = (
  callee: types.Node,
  property: string,
  object?: string
): boolean =>
  types.isMemberExpression(callee) &&
  types.isIdentifier(callee.property, { name: property }) &&
  (object === undefined || types.isIdentifier(callee.object, { name: object }));

/**
 * The string literals that name a thing for tracing or for the service
 * registry. A `Schema.TaggedError` tag is absent because `catchTag` matches on
 * it.
 */
const IDENTIFIER_KINDS: readonly IdentifierKind[] = [
  {
    matches: ({ call }) => isMemberNamed(call.callee, "fn", "Effect"),
    reason: "Effect.fn span name: names a trace span and changes no behaviour",
  },
  {
    matches: ({ call, callParent }) =>
      types.isCallExpression(call.callee) &&
      isMemberNamed(call.callee.callee, "Service") &&
      types.isClass(callParent) &&
      callParent.superClass === call,
    reason: "Service key: names a service class and changes no behaviour",
  },
];

/**
 * The reason Stryker reports for leaving a naming string literal unmutated,
 * or `undefined` for any other node the instrumenter visits.
 */
export const reasonToIgnore = (path: NodePath): string | undefined => {
  if (!path.isStringLiteral()) {
    return undefined;
  }
  const call = path.parentPath.node;
  if (!types.isCallExpression(call) || call.arguments[0] !== path.node) {
    return undefined;
  }
  const site = { call, callParent: path.parentPath.parentPath.node };
  return IDENTIFIER_KINDS.find((kind) => kind.matches(site))?.reason;
};

export const strykerPlugins = [
  declareValuePlugin(PluginKind.Ignore, IGNORER_NAME, {
    shouldIgnore: reasonToIgnore,
  }),
];
