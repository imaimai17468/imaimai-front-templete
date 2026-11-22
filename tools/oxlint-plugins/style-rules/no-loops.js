const noLoops = {
  create(context) {
    const report = (node) =>
      context.report({
        message:
          "Loops are forbidden. Use functional alternatives: map, filter, reduce, flatMap, forEach, some, every, find.",
        node,
      });
    return {
      DoWhileStatement: report,
      ForInStatement: report,
      ForOfStatement: report,
      ForStatement: report,
      WhileStatement: report,
    };
  },
};

export default noLoops;
