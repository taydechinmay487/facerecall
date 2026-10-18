import "@testing-library/jest-dom/vitest";

// jsdom does not implement these browser APIs that the camera and preview code uses.
Object.defineProperty(URL, "createObjectURL", {
  value: () => "blob:mock",
  writable: true,
  configurable: true,
});
Object.defineProperty(URL, "revokeObjectURL", {
  value: () => undefined,
  writable: true,
  configurable: true,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
  writable: true,
  configurable: true,
  value: (callback: (blob: Blob | null) => void) =>
    callback(new Blob(["frame"], { type: "image/jpeg" })),
});

Object.defineProperty(HTMLMediaElement.prototype, "play", {
  writable: true,
  configurable: true,
  value: () => Promise.resolve(),
});
