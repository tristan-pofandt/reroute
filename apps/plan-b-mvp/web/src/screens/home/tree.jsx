// Shared by the home, dashboard and rides screens. The legacy builders hold the pure logic (impact maths, formatting, icons, settings),
// and app.js does not export those helpers, so the markup is read from RerouteLegacy.SCREENS[name]() on every `reroute:rerender`
// and turned into real React elements (not innerHTML), keeping every class, aria attribute and data-action the legacy handlers expect.
// The React part is the structure around it: keyed reconciliation (inputs and focus survive a rerender), the page choreography (the direct
// children of the navbar and `.scroll` are staggered Items, persistent elements are layoutId Shared ones, see shared.jsx), haptics.
import { createElement, useEffect, useMemo, useState } from "react";
import { legacyNode } from "../../shared.jsx";
import { snap, tick } from "../../haptics.js";

const ATTR = { class: "className", for: "htmlFor", tabindex: "tabIndex", maxlength: "maxLength", readonly: "readOnly", autocomplete: "autoComplete", colspan: "colSpan", rowspan: "rowSpan", inputmode: "inputMode", value: "defaultValue", checked: "defaultChecked" };
const BOOL = new Set(["disabled", "hidden", "required", "readonly", "checked", "multiple", "autofocus"]);
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function style(css) {
  const o = {};
  for (const d of css.split(";")) {
    const i = d.indexOf(":");
    if (i > 0) { const k = d.slice(0, i).trim(); o[k.startsWith("--") ? k : camel(k)] = d.slice(i + 1).trim(); }
  }
  return o;
}

function props(el, key) {
  const p = { key };
  for (const { name, value } of el.attributes) {
    if (name === "style") p.style = style(value);
    else if (BOOL.has(name)) p[ATTR[name] || name] = true;
    else if (ATTR[name]) p[ATTR[name]] = value;
    else if (/^(aria-|data-)/.test(name) || !name.includes("-")) p[name] = value;
    else p[camel(name)] = value; // svg presentation attributes: stroke-width -> strokeWidth
  }
  return p;
}

function toReact(node, key, target = false, index = 0) {
  if (node.nodeType === 3) return node.nodeValue;
  if (node.nodeType !== 1) return null;
  const tag = node.localName;
  const p = props(node, key);
  const kids = (n, t) => [...n.childNodes].map((c, i) => toReact(c, i, t, i));
  // The page body and the navbar hand "stagger me" down to their direct children; shared elements (layoutId) and the containers that
  // hold them are handled in legacyNode, see shared.jsx.
  const made = legacyNode(node, p, index, target, kids);
  if (made) return made;
  return createElement(tag, p, ...kids(node, node.matches(".scroll, header.navbar, footer.sticky")));
}

const html = (name) => window.RerouteLegacy.SCREENS[name]();

export function useScreenHtml(name) {
  const [h, setH] = useState(() => html(name));
  useEffect(() => {
    const on = () => setH(html(name));
    document.addEventListener("reroute:rerender", on);
    on(); // state may have changed between the first render and this effect
    return () => document.removeEventListener("reroute:rerender", on);
  }, [name]);
  return h;
}

// `haptics`: { "<data-action>": "tick" | "snap" } fired on press, on top of the shell's own button tick.
export function LegacyBody({ name, haptics = {} }) {
  const h = useScreenHtml(name);
  const tree = useMemo(() => {
    const doc = new DOMParser().parseFromString(h, "text/html");
    return [...doc.body.childNodes].map((n, i) => toReact(n, i));
  }, [h]);
  useEffect(() => {
    const on = (e) => {
      const el = e.target.closest?.("[data-action]");
      const kind = el?.closest(`.page[data-screen="${name}"]`) && haptics[el.dataset.action];
      if (kind === "snap") snap(); else if (kind) tick();
    };
    document.addEventListener("click", on, true);
    return () => document.removeEventListener("click", on, true);
  }, [name, haptics]);
  return <>{tree}</>;
}
