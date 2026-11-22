const TEST_STEM_SUFFIX = /\.(?:test|spec)$/u;

export const isTestStem = (stem) => TEST_STEM_SUFFIX.test(stem);
