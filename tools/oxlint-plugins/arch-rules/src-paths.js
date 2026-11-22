const SRC_MARKER = "/src/";

/** The file's path from `src/` down, or `null` when it sits outside `src/`. */
export const srcPathOf = (context) => {
  const filename = context.filename ?? context.getFilename?.();
  if (!filename) {
    return null;
  }
  const srcIndex = filename.lastIndexOf(SRC_MARKER);
  if (srcIndex === -1) {
    return null;
  }
  return filename.slice(srcIndex + 1);
};
