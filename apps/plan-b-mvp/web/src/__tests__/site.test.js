import { describe, expect, it } from "vitest";
import { ABUSE_EMAIL, PRIVACY_EMAIL, SITE_DOMAIN, SUPPORT_EMAIL } from "../config/site.js";
import * as contact from "../screens/legal/contact.js";

describe("site config", () => {
  it("has non-empty values (placeholders unless VITE_* is set) and contact.js re-exports them", () => {
    for (const v of [SITE_DOMAIN, SUPPORT_EMAIL, ABUSE_EMAIL, PRIVACY_EMAIL]) expect(v).toBeTruthy();
    expect(contact.SUPPORT_EMAIL).toBe(SUPPORT_EMAIL);
    expect(contact.ABUSE_EMAIL).toBe(ABUSE_EMAIL);
    expect(contact.PRIVACY_EMAIL).toBe(PRIVACY_EMAIL);
  });
});
