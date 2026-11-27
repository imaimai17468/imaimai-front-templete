// A name whose first character is an uppercase letter in any script, which
// `\p{Lu}` matches where `[A-Z]` would miss `Ä` or `Σ`.
const COMPONENT_NAME_RE = /^\p{Lu}/u;

/**
 * Whether a value reads as a component's name. A value that is not a string,
 * such as `undefined` or an AST node, reads as its string form under `test`
 * (`"undefined"`, `"[object Object]"`), and neither opens with a capital.
 */
export const isComponentName = (name) => COMPONENT_NAME_RE.test(name);
