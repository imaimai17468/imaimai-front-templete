import "@testing-library/jest-dom/vitest";
import { vi } from "vite-plus/test";

// jsdom は ResizeObserver を持たないが、Radix の Popper が Arrow の
// 寸法を測るのに使う。
class ResizeObserverStub implements ResizeObserver {
  observe = vi.fn<() => void>();
  unobserve = vi.fn<() => void>();
  disconnect = vi.fn<() => void>();
}

globalThis.ResizeObserver = ResizeObserverStub;

// jsdom は scrollTo を実装せず、呼ばれるたびに "Not implemented" を出す。
// TanStack Router のスクロール復元が遷移ごとに呼ぶ。
vi.stubGlobal("scrollTo", vi.fn<() => void>());
