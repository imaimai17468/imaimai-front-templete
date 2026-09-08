import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vite-plus/test";

// jsdom は ResizeObserver を持たないが、Radix の Popper が Arrow の
// 寸法を測るのに使う。
class ResizeObserverStub implements ResizeObserver {
  observe = vi.fn<() => void>();
  unobserve = vi.fn<() => void>();
  disconnect = vi.fn<() => void>();
}

globalThis.ResizeObserver = ResizeObserverStub;

afterEach(() => {
  cleanup();
});
