import { describe, expect, it } from "vitest";
import { error, snap, thud, tick } from "../haptics.js";
import { reducedMotion } from "../reduced.js";

describe("haptics", () => {
  it("vibrates with the web patterns", () => {
    tick();
    expect(navigator.vibrate).toHaveBeenLastCalledWith(6);
    thud();
    expect(navigator.vibrate).toHaveBeenLastCalledWith(16);
    snap();
    expect(navigator.vibrate).toHaveBeenLastCalledWith([8, 14, 8]);
    error();
    expect(navigator.vibrate).toHaveBeenLastCalledWith([30, 40, 30, 40, 60]);
  });

  it("is silent when the in-app Reduce motion switch is on", () => {
    document.documentElement.dataset.motion = "reduced";
    tick();
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  it("follows the system setting, unless the app forces full motion", () => {
    window.__reduce = true;
    expect(reducedMotion()).toBe(true);
    tick();
    expect(navigator.vibrate).not.toHaveBeenCalled();
    document.documentElement.dataset.motion = "full";
    expect(reducedMotion()).toBe(false);
    tick();
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);
  });

  it("never throws when vibrate is missing", () => {
    const keep = navigator.vibrate;
    navigator.vibrate = undefined;
    expect(() => tick()).not.toThrow();
    navigator.vibrate = keep;
  });

  it("uses the native path, not vibrate, inside the Capacitor shell", () => {
    window.Capacitor = { isNativePlatform: () => true };
    tick();
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });
});
