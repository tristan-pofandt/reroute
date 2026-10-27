// Pure helpers copied from the legacy weather page in app.js (same output text).
export const WX_TONE = { sun: "var(--warning)", moon: "var(--violet)", "cloud-sun": "var(--warning)", cloud: "var(--text-muted)", fog: "var(--text-muted)", drizzle: "var(--accent)", rain: "var(--accent)", storm: "var(--violet)", snow: "var(--teal)", wind: "var(--teal)", heat: "var(--error)" };
export const WX_ICON = { sun: "sun", moon: "moon", "cloud-sun": "cloudSun", cloud: "cloud", fog: "fog", drizzle: "drizzle", rain: "rain", storm: "storm", snow: "snow", wind: "wind", heat: "heat" };
export const GUST_WARN_KMH = 50; // the same gust limit the server uses for bad-weather warnings

const clock = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", hour: "numeric", minute: "2-digit", hour12: true });
const hour = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", hour: "numeric", hour12: true });
const weekday = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "UTC" });
export const timeOf = (iso) => clock.format(new Date(iso)).replace(" ", " ");
export const hourOf = (iso) => hour.format(new Date(iso)).replace(/[  ]/g, " ");
export const dayName = (date, i) => (i === 0 ? "Today" : weekday.format(new Date(`${date}T00:00:00Z`)));
export const localClock = (local) => (local ? timeOf(`${local.slice(0, 16)}:00+10:00`) : "–");
export const uvLabel = (uv) => (uv < 3 ? "Low" : uv < 6 ? "Moderate" : uv < 8 ? "High" : uv < 11 ? "Very high" : "Extreme");
