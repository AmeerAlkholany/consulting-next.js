import "@/config/load-env";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Mock server-only so tests in Node environment can import modules marked server-only
vi.mock("server-only", () => {
  return {};
});

const hasDom = typeof window !== "undefined" && typeof document !== "undefined";

/**
 * jsdom omits a few browser APIs that Radix primitives and motion-aware
 * components expect. They are stubbed for the jsdom project only; the node
 * project never touches them.
 */
const globalScope = globalThis as unknown as Record<string, unknown>;

if (hasDom) {
  if (typeof globalScope.ResizeObserver !== "function") {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalScope.ResizeObserver = ResizeObserverStub;
  }

  if (typeof globalScope.matchMedia !== "function") {
    globalScope.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
}

afterEach(() => {
  if (hasDom) {
    cleanup();
  }
});
