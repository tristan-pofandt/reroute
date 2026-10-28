import { describe, expect, it } from "vitest";
import { hasShared, setNav, sharedId } from "../shared.jsx";

const withScreens = (native, html) => {
  window.RerouteBridge = { isNative: (s) => native.includes(s) };
  window.RerouteLegacy = { SCREENS: Object.fromEntries(Object.entries(html).map(([k, v]) => [k, () => v])) };
};

describe("hasShared: shared elements only morph when the other screen has the counterpart", () => {
  it("a legacy-HTML screen never has shared elements", () => {
    withScreens(["home"], { rides: '<a class="nav-back"></a>' });
    setNav("home", "rides");
    expect(hasShared("rides", "nav-back")).toBe(false);
  });
  it("home always has the impact button; the dashboard only with a lead figure", () => {
    withScreens(["home", "dashboard"], { dashboard: '<div class="kpi">x</div>' });
    setNav("home", "dashboard");
    expect(hasShared("home", "impact")).toBe(true);
    expect(hasShared("dashboard", "impact")).toBe(false);
    withScreens(["home", "dashboard"], { dashboard: '<div class="kpi lead">x</div>' });
    setNav("dashboard", "home");
    expect(hasShared("dashboard", "impact")).toBe(true);
  });
  it("reads back, home and title from a native screen's markup", () => {
    withScreens(["weather"], { weather: '<header><a class="nav-back"></a><a class="home-btn"></a><h1 class="large-title">W</h1></header>' });
    setNav("x", "weather");
    for (const id of ["nav-back", "nav-home", "title"]) expect(hasShared("weather", id)).toBe(true);
  });
  it("maps selectors to ids", () => {
    const el = document.createElement("button");
    el.className = "impact-btn";
    expect(sharedId(el)).toBe("impact");
  });
  it("is false for unknown or missing screens", () => {
    withScreens([], {});
    expect(hasShared(null, "title")).toBe(false);
    expect(hasShared("nope", "title")).toBe(false);
  });
});
