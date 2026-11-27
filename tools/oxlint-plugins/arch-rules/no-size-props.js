import { isComponentName } from "./component-names.js";

const noSizeProps = {
  create(context) {
    return {
      JSXAttribute(node) {
        const propName = node.name.name;
        if (propName !== "width" && propName !== "height") {
          return;
        }
        const openingElement = node.parent;
        if (!openingElement) {
          return;
        }
        const elementName = openingElement.name;
        if (
          elementName.type === "JSXMemberExpression" ||
          isComponentName(elementName.name)
        ) {
          context.report({
            message: `Do not pass '${propName}' prop to components. Control size externally via the parent's CSS layout.`,
            node,
          });
        }
      },
    };
  },
};

export default noSizeProps;
