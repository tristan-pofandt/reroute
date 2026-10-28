import { describe, expect, it } from "vitest";
import { CAP, CAP_OUT, DUR, EASE, STAGGER_IN, STAGGER_OUT, clamp, getDirection, settle, setDirection, travel } from "../choreography.js";

describe("choreography values", () => {
  it("keeps the documented stagger and caps", () => {
    expect(STAGGER_IN).toBe(0.03);
    expect(STAGGER_OUT).toBeLessThan(STAGGER_IN); // leaving is faster than arriving
    expect(CAP).toBe(7);
    expect(CAP_OUT).toBeLessThan(CAP);
    expect((CAP - 1) * STAGGER_IN * 1000).toBeLessThanOrEqual(200); // the last capped element starts within 200 ms
  });
  it("uses an ease-out curve and short press feedback", () => {
    expect(EASE).toEqual([0.22, 1, 0.36, 1]);
    expect(DUR.press).toBeLessThanOrEqual(0.16);
  });
  it("settle() is exact at both ends", () => {
    expect(settle(-1)).toBe(0);
    expect(settle(0)).toBe(0);
    expect(settle(1)).toBe(1);
    expect(settle(2)).toBe(1);
    expect(settle(0.2)).toBeGreaterThan(0);
  });
  it("clamp bounds", () => {
    expect(clamp(5)).toBe(1);
    expect(clamp(-5)).toBe(0);
    expect(clamp(0.4)).toBe(0.4);
  });
});

describe("direction mapping", () => {
  it("forward leaves left and arrives from the right; back is the mirror", () => {
    const out = travel("forward", "out"), inn = travel("forward", "in");
    expect(out.x).toBeLessThan(0);
    expect(inn.x).toBeGreaterThan(0);
    expect(travel("back", "out").x).toBe(-out.x);
    expect(travel("back", "in").x).toBe(-inn.x);
  });
  it("up and down move vertically only", () => {
    expect(travel("up", "in")).toEqual({ x: 0, y: 56 });
    expect(travel("down", "out")).toEqual({ x: 0, y: 56 });
    expect(travel("down", "in").y).toBeLessThan(0);
  });
  it("tracks the current direction and ignores empty values", () => {
    setDirection("back");
    expect(getDirection()).toBe("back");
    setDirection(undefined);
    expect(getDirection()).toBe("back");
    setDirection("forward");
  });
});
