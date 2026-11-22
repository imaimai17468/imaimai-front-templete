// A name whose first character is an uppercase letter in any script, which
// `\p{Lu}` matches where `[A-Z]` would miss `Ä` or `Σ`.
const COMPONENT_NAME_RE = /^\p{Lu}/u;

export const isComponentName = (name) =>
  typeof name === "string" && COMPONENT_NAME_RE.test(name);
