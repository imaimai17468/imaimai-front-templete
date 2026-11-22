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
]);

const roleOf = (segments) =>
  ROLE_BY_SEGMENT.get(
    segments.findLast((segment) => ROLE_BY_SEGMENT.has(segment))
  ) ?? null;

/** Which layer a `src/`-relative path sits in, or `null` for none. */
export const layerOf = (srcPath) => {
  const role = roleOf(srcPath.split("/"));
  if (role !== null) {
    return role;
  }
  // shadcn CLI output. `components.json` writes to this one path, so the
  // exception is anchored to it rather than to the segment name, which would
  // also take a `ui/` directory somewhere else out of its own layer.
  if (srcPath.startsWith("src/shared/ui/")) {
    return "component";
  }
  // The directory itself, because an import target can name it without a
  // trailing segment (`@/routes`) and that target sits in the layer too.
  if (srcPath === "src/lib" || srcPath.startsWith("src/lib/")) {
    return "adapter";
  }
  if (srcPath === "src/routes" || srcPath.startsWith("src/routes/")) {
    return "route";
  }
  return null;
};
