// Weather page, native. The forecast (now, 24 hours, 7 days) is React; the rain radar (Google map, RainViewer frames, time slider and the
// next-hour chart) stays an island of legacy-built HTML because its map, playback timer and DOM patching live in app.js (buildRadarMap,
// radarPlay, showRadarFrame) and are driven by the data-action/data-map hooks, which keep working inside it.
import { useEffect, useMemo, useReducer, useRef } from "react";
import { motion } from "framer-motion";
import { Icon, Navbar } from "./legal/Chrome.jsx";
import { useReducedMotion } from "../reduced.js";
import { snap } from "../haptics.js";
import { WX_TONE, WX_ICON, GUST_WARN_KMH, timeOf, hourOf, dayName, localClock, uvLabel } from "./weather/format.js";

const L = () => window.RerouteLegacy;
const Sim = ({ on }) => (on ? <span className="sim-tag">Simulated</span> : null);
const WxIcon = ({ name, size }) => <Icon name={WX_ICON[name] || "cloud"} size={size} />;
const num = (v) => v === null || v === undefined;
const EASE = [0.23, 1, 0.32, 1];
const rise = { hide: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } } };
const list = { hide: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } };

// renderWeatherPage() patches the DOM and fires no event, so watch the state fields it depends on.
function useWeatherState() {
  const [, bump] = useReducer((n) => n + 1, 0);
  const seen = useRef([]);
  useEffect(() => {
    const check = () => {
      const s = L().state, k = [s.weatherDetail, s.weatherDetailError, s.weatherPlace, s.demo?.on];
      if (k.some((v, i) => v !== seen.current[i])) { seen.current = k; bump(); }
    };
    check();
    const t = setInterval(check, 250);
    document.addEventListener("reroute:rerender", check);
    return () => { clearInterval(t); document.removeEventListener("reroute:rerender", check); };
  }, []);
  const s = L().state;
  return { detail: s.weatherDetail, error: s.weatherDetailError, place: s.weatherPlace, demo: !!s.demo?.on };
}

function Now({ d }) {
  const c = d.current, today = d.days?.[0], now = d.hourly?.[0];
  const stat = (icon, label, value, sub) => (
    <motion.div className="wxp-stat" variants={rise}>
      <span className="wxp-stat-label"><Icon name={icon} size={14} />{label}</span><b>{value}</b>{sub ? <small>{sub}</small> : null}
    </motion.div>
  );
  const wind = (
    <>
      {c.wind_from ? <span className="wind-dir">{num(c.wind_dir) ? null : <span className="wind-arrow" style={{ transform: `rotate(${(c.wind_dir + 180) % 360}deg)` }} aria-hidden="true"><Icon name="arrowUp" size={12} /></span>}From {c.wind_from}</span> : null}
      Gusts {Math.round(c.gust_kmh)} km/h
    </>
  );
  return (
    <>
      <section className="wxp-now">
        <div className="wx-temp">{Math.round(c.temp_c)}<sup>°</sup></div>
        <div className="wx-now"><strong>{c.label}</strong><span>Feels like {Math.round(c.apparent_c)}°{today ? ` · High ${Math.round(today.max_c)}° · Low ${Math.round(today.min_c)}°` : ""}</span></div>
        <span className="wx-icon" style={{ "--tone": WX_TONE[c.icon] || "var(--accent)" }}><WxIcon name={c.icon} size={30} /></span>
      </section>
      {d.bad && d.warning ? (
        <div className="wx-warn" role="alert"><Icon name="alert" size={18} /><div><b>{d.warning}<Sim on={d.simulated} /></b><span>Allow extra time if your trip includes walking between stops.</span></div></div>
      ) : null}
      <motion.div className="wxp-stats" variants={list} initial="hide" animate="show">
        {stat("wind", "Wind", `${Math.round(c.wind_kmh)} km/h`, wind)}
        {stat("droplet", "Humidity", num(c.humidity) ? "–" : `${Math.round(c.humidity)}%`)}
        {stat("rain", "Rain chance", num(now?.precip_prob) ? "–" : `${now.precip_prob}%`, today?.precip_mm ? `${today.precip_mm} mm today` : "No rain expected today")}
        {stat("sun", "UV index", num(today?.uv) ? "–" : `${Math.round(today.uv)}`, num(today?.uv) ? "" : `${uvLabel(today.uv)} today`)}
        {stat("sunrise", "Sunrise", localClock(today?.sunrise))}
        {stat("sunset", "Sunset", localClock(today?.sunset))}
      </motion.div>
    </>
  );
}

function Rest({ d, demo }) {
  const days = d.days || [];
  const lo = Math.min(...days.map((x) => x.min_c)), hi = Math.max(...days.map((x) => x.max_c)), span = Math.max(1, hi - lo);
  return (
    <>
      <p className="section-header">Next 24 hours</p>
      <motion.div className="wxp-hours" role="list" aria-label="Next 24 hours" variants={list} initial="hide" animate="show">
        {(d.hourly || []).map((h, i) => (
          <motion.div className="wxp-hour" role="listitem" key={h.time || i} variants={rise}>
            <span>{i ? hourOf(h.time) : "Now"}</span><WxIcon name={h.icon} size={22} /><b>{Math.round(h.temp_c)}°</b><i>{h.precip_prob >= 20 ? `${h.precip_prob}%` : ""}</i><small>{Math.round(h.wind_kmh)} km/h</small>
          </motion.div>
        ))}
      </motion.div>
      <p className="section-header">Next 7 days</p>
      <div className="group"><motion.div className="group-card" variants={list} initial="hide" animate="show">
        {days.map((x, i) => (
          <motion.div className="wxp-day" key={x.date} variants={rise}>
            <div className="wxp-day-main" aria-hidden="true"><span className="wxp-day-name">{dayName(x.date, i)}</span><span className="wxp-day-icon" style={{ color: WX_TONE[x.icon] || "var(--text-main)" }}><WxIcon name={x.icon} size={20} /></span>
              <span className="wxp-day-rain">{x.precip_prob >= 20 ? `${x.precip_prob}%` : ""}</span>
              <span className="wxp-day-temps"><small>{Math.round(x.min_c)}°</small><span className="wxp-range"><i style={{ left: `${((x.min_c - lo) / span) * 100}%`, right: `${100 - ((x.max_c - lo) / span) * 100}%` }}></i></span><b>{Math.round(x.max_c)}°</b></span></div>
            <div className="wxp-day-sub" aria-hidden="true">{x.label}{x.precip_mm ? ` · ${x.precip_mm} mm` : ""} · wind {Math.round(x.wind_kmh)} km/h{x.wind_from ? ` ${x.wind_from}` : ""}{x.gust_kmh >= GUST_WARN_KMH ? `, gusts ${Math.round(x.gust_kmh)}` : ""}</div>
            <span className="visually-hidden">{dayName(x.date, i)}: {x.label}, low {Math.round(x.min_c)}, high {Math.round(x.max_c)} degrees{x.precip_prob ? `, ${x.precip_prob}% chance of rain` : ""}, wind up to {Math.round(x.wind_kmh)} km/h{x.wind_from ? ` from the ${x.wind_from}` : ""}.</span>
          </motion.div>
        ))}
      </motion.div></div>
      <p className="fine">Forecast and next-hour rain by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> (CC BY 4.0){d.simulated ? " · Simulated for demo mode" : ` · updated ${timeOf(d.fetched_at)}`}. Rain radar (the past two hours only) by <a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer">RainViewer</a>{demo && d.simulated ? ", which stays live in demo mode" : ""}.</p>
    </>
  );
}

// The legacy radar block (map wrap, legend, next-hour chart) is taken from SCREENS.weather() once, so it stays identical to the
// legacy page and app.js keeps patching it in place. React never re-renders its children.
function radarHTML() {
  const doc = new DOMParser().parseFromString(`<body>${L().SCREENS.weather()}</body>`, "text/html");
  const out = [];
  let el = [...doc.querySelectorAll(".scroll > .section-header")].find((p) => p.textContent === "Rain radar")?.nextElementSibling;
  for (; el && !el.hasAttribute("data-wxp-rest"); el = el.nextElementSibling) out.push(el.outerHTML);
  return out.join("");
}

export default function WeatherScreen() {
  const reduced = useReducedMotion();
  const { detail, error, place, demo } = useWeatherState();
  const html = useMemo(radarHTML, []);
  const had = useRef(!!detail);
  useEffect(() => { if (detail && !had.current) snap(); had.current = !!detail; }, [detail]);
  const fade = reduced ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: EASE } };

  return (
    <>
      <Navbar />
      <div className="scroll">
        {/* display:contents wrapper keeps app.js's `.scroll > .eyebrow` patch from replacing React-owned nodes */}
        <div style={{ display: "contents" }}>
          <p className="eyebrow"><Icon name="cloud" size={14} />Weather · {place}<Sim on={detail?.simulated} /></p>
        </div>
        <h2 className="large-title">Weather</h2>
        <div key={detail ? "d" : error ? "e" : "s"}>
          {detail ? <Now d={detail} /> : error ? (
            <motion.div className="empty-card" {...fade}><div className="empty-icon"><Icon name="cloud" size={24} /></div><h3>Weather is unavailable</h3><p>{error}</p></motion.div>
          ) : (
            <div className="wx-skel" role="status" aria-label="Loading the weather"><div className="skeleton skel-block" style={{ height: 96 }}></div><div className="skeleton skel-block" style={{ height: 150 }}></div></div>
          )}
        </div>
        <p className="section-header">Rain radar</p>
        <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />
        {detail ? <div><Rest d={detail} demo={demo} /></div> : null}
      </div>
    </>
  );
}
