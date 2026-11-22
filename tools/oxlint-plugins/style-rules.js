import noLoops from "./style-rules/no-loops.js";

const plugin = {
  meta: { name: "style-rules" },
  rules: {
    "no-loops": noLoops,
  },
};

export default plugin;
