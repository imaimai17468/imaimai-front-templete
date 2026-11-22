const SOURCE_EXTENSION = /\.(?:tsx?|jsx?)$/u;

const TEST_STEM_SUFFIX = /\.(?:test|spec)$/u;

const SRC_MARKER = "/src/";

/** The path of the file being linted, or `undefined` when the linter supplies none. */
export const filenameOf = (context) =>
  context.filename ?? context.getFilename?.();

/** The file's path from `src/` down, or `null` when it sits outside `src/`. */
export const srcPathOf = (context) => {
  const filename = filenameOf(context);
  if (!filename) {
    return null;
  }
  const srcIndex = filename.lastIndexOf(SRC_MARKER);
  if (srcIndex === -1) {
    return null;
  }
  return filename.slice(srcIndex + 1);
};

export const stripSourceExtension = (path) =>
  path.replace(SOURCE_EXTENSION, "");

/** Whether a path with its source extension stripped names a test file. */
export const isTestStem = (stem) => TEST_STEM_SUFFIX.test(stem);
