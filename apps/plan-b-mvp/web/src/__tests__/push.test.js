import { describe, expect, it, vi } from "vitest";
import { nextStep, runEnable } from "../native/push.js";

const deps = (over = {}) => ({
  check: vi.fn(async () => "prompt"), request: vi.fn(async () => "granted"), register: vi.fn(async () => "tok"), prime: vi.fn(async () => true),
  send: vi.fn(async () => ({ ok: true, id: "n1" })), track: vi.fn(), ...over,
});

describe("push priming state machine", () => {
  it("maps permission and sheet answers to the next step", () => {
    expect(nextStep("granted")).toBe("register");
    expect(nextStep("denied")).toBe("settings");
    expect(nextStep("prompt")).toBe("prime");
    expect(nextStep("prompt", true)).toBe("ask-os");
    expect(nextStep("prompt", false)).toBe("later");
  });

  it("shows our sheet before the OS prompt, then registers", async () => {
    const d = deps();
    expect(await runEnable(d, { lines: ["412"] })).toEqual({ ok: true, id: "n1", token: "tok" });
    expect(d.prime.mock.invocationCallOrder[0]).toBeLessThan(d.request.mock.invocationCallOrder[0]);
    expect(d.send).toHaveBeenCalledWith("tok", { lines: ["412"] });
    expect(d.track).toHaveBeenCalledWith(true);
  });

  it("Not now never reaches the OS prompt", async () => {
    const d = deps({ prime: vi.fn(async () => false) });
    const r = await runEnable(d, null);
    expect(r).toMatchObject({ ok: false, reason: "later" });
    expect(d.request).not.toHaveBeenCalled();
    expect(d.send).not.toHaveBeenCalled();
  });

  it("an already granted permission skips the sheet", async () => {
    const d = deps({ check: vi.fn(async () => "granted") });
    expect((await runEnable(d, null)).ok).toBe(true);
    expect(d.prime).not.toHaveBeenCalled();
    expect(d.request).not.toHaveBeenCalled();
  });

  it("a denied permission points to system settings without any prompt", async () => {
    const d = deps({ check: vi.fn(async () => "denied") });
    const r = await runEnable(d, null);
    expect(r).toMatchObject({ ok: false, reason: "denied" });
    expect(r.message).toMatch(/Settings/);
    expect(d.prime).not.toHaveBeenCalled();
  });

  it("refusing the OS prompt reports denied and tracks it", async () => {
    const d = deps({ request: vi.fn(async () => "denied") });
    expect(await runEnable(d, null)).toMatchObject({ ok: false, reason: "denied" });
    expect(d.track).toHaveBeenCalledWith(false);
    expect(d.register).not.toHaveBeenCalled();
  });

  it("explains a server that has native push switched off", async () => {
    const d = deps({ send: vi.fn(async () => ({ ok: false, status: 503 })) });
    expect((await runEnable(d, null)).message).toMatch(/isn't set up/);
  });
});
