import "@testing-library/jest-dom/vitest";

/**
 * jsdom has no ResizeObserver, and several design-system components measure
 * themselves with one: `AutoHeight` (the collapsing helper line under every
 * field), the dialog body's scroll detection, the tab highlight. Without this
 * stub any test that renders a Field or a Dialog throws before it asserts
 * anything.
 *
 * A no-op is enough — the tests assert what is rendered, not what it measures.
 */
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
