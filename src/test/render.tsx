import {
  cleanup,
  render as renderIntoDocument,
  within,
} from "@testing-library/react";
import type { RenderOptions, RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { onTestFinished } from "vite-plus/test";

/**
 * Renders into the document and answers queries scoped to what it rendered.
 *
 * Testing Library binds a render's queries to `baseElement`, which is
 * `document.body`, so two tests rendering the same text collide through it.
 * Scoping to the container instead means a test only sees its own tree, and a
 * test that needs the whole document, as a portal's content requires, reaches
 * for `screen` and says so.
 *
 * The unmount is registered per call rather than in a lifecycle hook: Testing
 * Library's own `afterEach` registers once per module import, so under
 * `isolate: false` only the first file in a worker gets it.
 */
export const render = (
  ui: ReactElement,
  options?: RenderOptions
): RenderResult => {
  onTestFinished(cleanup);
  const result = renderIntoDocument(ui, options);
  return { ...result, ...within(result.container) };
};
