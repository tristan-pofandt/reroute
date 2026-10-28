import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../legacyLoader.js", () => ({ loadLegacy: () => new Promise(() => {}) }));
vi.mock("../motion/MotionLayer.jsx", () => ({ default: () => null }));
vi.mock("../motion/launch.js", () => ({ runLaunch: () => {} }));
vi.mock("../Routes.jsx", () => ({ default: () => null }));

const { default: App } = await import("../App.jsx");

describe("accessible names on the app shell", () => {
  const doc = new DOMParser().parseFromString(renderToStaticMarkup(<App />), "text/html");
  it("every button has a visible label or aria-label", () => {
    const buttons = [...doc.querySelectorAll("button")];
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) expect((b.getAttribute("aria-label") || b.textContent).trim(), b.outerHTML).not.toBe("");
  });
  it("the status banner is a polite live region and the splash is hidden from assistive tech", () => {
    const banner = doc.getElementById("net-banner");
    expect(banner.getAttribute("role")).toBe("status");
    expect(banner.getAttribute("aria-live")).toBe("polite");
    expect(doc.getElementById("splash").getAttribute("aria-hidden")).toBe("true");
  });
  it("the page body is a main landmark", () => {
    expect(doc.querySelector("main#viewport")).not.toBeNull();
  });
});
