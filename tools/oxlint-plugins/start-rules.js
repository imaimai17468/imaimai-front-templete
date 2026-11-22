import noRewrittenFactoryInHandler from "./start-rules/no-rewritten-factory-in-handler.js";

const plugin = {
  meta: { name: "start-rules" },
  rules: {
    "no-rewritten-factory-in-handler": noRewrittenFactoryInHandler,
  },
};

export default plugin;
