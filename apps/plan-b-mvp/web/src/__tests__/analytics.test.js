import { beforeEach, describe, expect, it, vi } from "vitest";
import { clean, EVENTS } from "../analytics/schema.js";
import { asked, consent, setConsent } from "../analytics/consent.js";
import { discard, flush, pending, track } from "../analytics/index.js";
import { scrub, scrubUrls } from "../errors/report.js";

const configure = () => { vi.stubEnv("VITE_POSTHOG_KEY", "phc_test"); vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example"); };
beforeEach(() => { vi.unstubAllEnvs(); discard(); window.__release = undefined; });

describe("schema allow-list", () => {
  it("drops unknown events and properties and bad values", () => {
    expect(clean("not_an_event", {})).toBeNull();
    expect(clean("__proto__", {})).toBeNull();
    expect(clean("trip_planned", { origin_kind: "gps", address: "1 Main St", dest_kind: "somewhere" })).toEqual({ origin_kind: "gps" });
    expect(clean("trip_logged", { distance_band: "free text with spaces and an address" })).toEqual({});
  });
  it("never allows a property that looks like PII", () => {
    const bad = /^(email|name|address|lat|lng|coords?|place|query|text|token|endpoint|note)$|_(name|address|text)$/;
    for (const [event, spec] of Object.entries(EVENTS)) for (const key of Object.keys(spec)) expect(key, `${event}.${key}`).not.toMatch(bad);
  });
});

describe("track()", () => {
  it("does nothing, and sends nothing, without a build key", () => {
    setConsent(true);
    track("sort_changed", { sort: "co2" });
    expect(pending()).toBe(0);
  });
  it("does nothing without consent even when configured", () => {
    configure();
    track("sort_changed", { sort: "co2" });
    expect(pending()).toBe(0);
    expect(asked()).toBe(false);
    setConsent(false);
    track("sort_changed", { sort: "co2" });
    expect(pending()).toBe(0);
    expect(localStorage.getItem("planb.analyticsId")).toBeNull();
  });
  it("queues a clean event with a random install id once consent is granted, and posts without cookies", () => {
    configure();
    const beacon = vi.fn(() => true);
    navigator.sendBeacon = beacon;
    setConsent(true);
    track("sort_changed", { sort: "co2", email: "a@b.c" });
    expect(pending()).toBe(1);
    flush();
    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0];
    expect(url).toBe("https://ph.example/batch/");
    return new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsText(blob); }).then((t) => {
      const body = JSON.parse(t);
      const e = body.batch[0];
      expect(e.properties.sort).toBe("co2");
      expect(JSON.stringify(body)).not.toContain("a@b.c");
      expect(e.distinct_id).toBe(localStorage.getItem("planb.analyticsId"));
    });
  });
  it("withdrawing consent empties the queue and deletes the id", () => {
    configure();
    setConsent(true);
    track("sort_changed", { sort: "co2" });
    setConsent(false);
    expect(pending()).toBe(0);
    expect(localStorage.getItem("planb.analyticsId")).toBeNull();
    expect(consent()).toBe("denied");
  });
});

describe("crash report scrubbing", () => {
  it("strips query strings and hashes from URLs and removes user and request data", () => {
    expect(scrubUrls("failed https://x.test/a/b?q=home+address&lat=1#frag ok")).toBe("failed https://x.test/a/b ok");
    const out = scrub({ user: { id: 1 }, request: { url: "u" }, breadcrumbs: [1], message: "see https://x.test/?a=1", exception: { values: [{ value: "at https://x.test/p?z=9", stacktrace: { frames: [{ filename: "https://x.test/app.js?v=1", vars: { a: 1 } }] } }] } });
    expect(out.user).toBeUndefined();
    expect(out.request).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
    expect(out.exception.values[0].stacktrace.frames[0]).toEqual({ filename: "https://x.test/app.js" });
  });
});
