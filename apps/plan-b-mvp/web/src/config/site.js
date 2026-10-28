// The ONE place for the public domain and contact mailboxes (build time: VITE_SITE_DOMAIN, VITE_SUPPORT_EMAIL, VITE_ABUSE_EMAIL, VITE_PRIVACY_EMAIL).
// The defaults are placeholders that never resolve; `python placeholders.py` lists any still in use. The server reads PLANB_*_EMAIL (site_config.py): set both to the same values.
const env = import.meta.env || {};
export const SITE_DOMAIN = env.VITE_SITE_DOMAIN || "reroute.example";
export const SUPPORT_EMAIL = env.VITE_SUPPORT_EMAIL || "support@reroute.invalid";
export const ABUSE_EMAIL = env.VITE_ABUSE_EMAIL || "abuse@reroute.invalid";
export const PRIVACY_EMAIL = env.VITE_PRIVACY_EMAIL || "privacy@reroute.invalid";
