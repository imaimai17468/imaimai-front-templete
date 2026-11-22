// An uppercase letter in any script, which is what "looks like a component"
// meant when this compared a character with its own upper- and lower-cased form.
const COMPONENT_NAME_RE = /^\p{Lu}/u;

export const isComponentName = (name) =>
  typeof name === "string" && COMPONENT_NAME_RE.test(name);
