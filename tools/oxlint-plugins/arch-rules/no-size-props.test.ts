import { describe, expect, it, vi } from "vite-plus/test";
import rule from "./no-size-props.js";

const makeContext = () => ({
  report: vi.fn<(descriptor: { message: string; node: unknown }) => void>(),
});

describe("no-size-props", () => {
  it("should report the prop and where size belongs on the attribute when width is on a custom component with uppercase JSXIdentifier", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "width" },
      parent: {
        name: { name: "Card", type: "JSXIdentifier" },
      },
    };

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report.mock.calls).toStrictEqual([
      [
        {
          message:
            "Do not pass 'width' prop to components. Control size externally via the parent's CSS layout.",
          node,
        },
      ],
    ]);
  });

  it("should report when height prop is on a custom component with uppercase JSXIdentifier", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "height" },
      parent: {
        name: { name: "Avatar", type: "JSXIdentifier" },
      },
    };

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report the prop and where size belongs on the attribute when width is on a JSXMemberExpression element", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "width" },
      parent: {
        name: {
          object: { name: "Icons" },
          property: { name: "Arrow" },
          type: "JSXMemberExpression",
        },
      },
    };

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report.mock.calls).toStrictEqual([
      [
        {
          message:
            "Do not pass 'width' prop to components. Control size externally via the parent's CSS layout.",
          node,
        },
      ],
    ]);
  });

  it("should report when height prop is on a JSXMemberExpression element", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "height" },
      parent: {
        name: {
          object: { name: "UI" },
          property: { name: "Box" },
          type: "JSXMemberExpression",
        },
      },
    };

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when width prop is on an HTML element with lowercase name", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "width" },
      parent: {
        name: { name: "img", type: "JSXIdentifier" },
      },
    };

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when height prop is on an HTML element with lowercase name", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "height" },
      parent: {
        name: { name: "div", type: "JSXIdentifier" },
      },
    };

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when className prop is on a custom component", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "className" },
      parent: {
        name: { name: "Card", type: "JSXIdentifier" },
      },
    };

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });
});

describe("no-size-props (defensive branches)", () => {
  it("should not report when the attribute has no parent element", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);

    // Act
    visitors.JSXAttribute({ name: { name: "width" }, parent: null });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the element name is a namespaced identifier", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "width" },
      parent: {
        name: {
          name: { name: "Rect", type: "JSXIdentifier" },
          namespace: { name: "Svg", type: "JSXIdentifier" },
          type: "JSXNamespacedName",
        },
      },
    };

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });
});
