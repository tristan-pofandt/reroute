// Shared by the journey / results / next screens. The legacy app.js builds these screens' markup from its own state, icons and
// formatters (CO2, cost and time figures included). Re-deriving all of that would risk different assumptions, so the screens ask the
// legacy builder for the page body and this file turns it into a React element tree: React owns the DOM (reconciled on every
// `reroute:rerender`, so focus, scroll and node identity survive), the parts legacy code mutates in place stay "islands", and the
// interesting elements (cards, steps, form controls) are swapped for React components by each screen's `custom` function.
import { createElement, useEffect, useLayoutEffect, useReducer, useRef } from "react";
import { error, snap, tick } from "../../haptics.js";

const legacy = () => window.RerouteLegacy;
const RENAME = { class: "className", for: "htmlFor", tabindex: "tabIndex", autocomplete: "autoComplete", spellcheck: "spellCheck", readonly: "readOnly", maxlength: "maxLength", inputmode: "inputMode", colspan: "colSpan" };
const BOOLEAN = new Set(["disabled", "hidden", "checked", "readonly", "required", "open"]);
const VOID = new Set(["input", "br", "hr", "img"]);
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function styleObject(css) {
  const out = {};
  css.split(";").forEach((d) => {
    const i = d.indexOf(":");
    if (i < 0) return;
    const k = d.slice(0, i).trim(), v = d.slice(i + 1).trim();
    if (k) out[k.startsWith("--") ? k : camel(k)] = v;
  });
  return out;
}

function propsOf(el) {
  const p = {};
  for (const { name, value } of el.attributes) {
    if (name === "style") p.style = styleObject(value);
    else if (BOOLEAN.has(name)) p[RENAME[name] || name] = true;
    else if (name.startsWith("aria-") || name.startsWith("data-") || name === "role") p[name] = value;
    else p[RENAME[name] || camel(name)] = value;
  }
  return p;
}

// A subtree legacy code rewrites or measures in place (autocomplete inputs wrapped with a clear button, live status lines, the map and
// its controls, the origin row that paintOrigin() repaints). React sets its HTML only when the string changes, then re-wraps the inputs.
export function Island({ tag, props, html }) {
  const ref = useRef(null);
  useLayoutEffect(() => { if (ref.current) legacy().enhanceClear(ref.current); }, [html]);
  return createElement(tag, { ...props, ref, dangerouslySetInnerHTML: { __html: html } });
}

// A checkbox or date input outside an island: uncontrolled, re-synced to the legacy state after each render unless being edited.
export function Field({ props, onChange }) {
  const ref = useRef(null);
  const { checked, value, ...rest } = props;
  useLayoutEffect(() => {
    const n = ref.current;
    if (!n) return;
    if (n.type === "checkbox") n.checked = !!checked;
    else if (document.activeElement !== n && n.value !== (value ?? "")) n.value = value ?? "";
  });
  return createElement("input", { ...rest, ref, onChange, defaultChecked: !!checked, defaultValue: value ?? "" });
}

const isIsland = (el, extra) => el.matches?.("[data-live], [data-live-age], [data-bg-slot], .map-wrap, .place-input") || extra?.(el);

function convert(node, opts, index) {
  if (node.nodeType === 3) return node.nodeValue;
  if (node.nodeType !== 1) return null;
  const tag = node.localName;
  const props = propsOf(node);
  if (isIsland(node, opts.island)) return createElement(Island, { key: index, tag, props, html: node.innerHTML });
  const kids = [...node.childNodes].map((c, i) => convert(c, opts, i)).filter((c) => c !== null);
  const custom = opts.custom?.({ el: node, tag, props, kids, index });
  if (custom) return custom; // customs set their own key
  if (tag === "input") {
    const v = node.getAttribute("value");
    const toggle = node.type === "checkbox" ? tick : undefined;
    return createElement(Field, { key: index, props: { ...props, value: v ?? undefined }, onChange: toggle });
  }
  return createElement(tag, { key: index, ...props }, VOID.has(tag) ? undefined : kids);
}

export function toReact(html, opts = {}) {
  const t = document.createElement("template");
  t.innerHTML = html;
  return [...t.content.childNodes].map((n, i) => convert(n, opts, i)).filter((n) => n !== null);
}

// Re-render when legacy code calls rerender(); put focus back on the same control afterwards (React keeps most nodes, but an island or a
// changed key replaces them) and let the legacy code mount maps that the new markup brought.
function twin(el, scope) {
  if (el.id && scope.querySelector(`#${CSS.escape(el.id)}`)) return scope.querySelector(`#${CSS.escape(el.id)}`);
  const sel = [...el.attributes].filter((a) => a.name.startsWith("data-") && a.name !== "data-lead").map((a) => `[${a.name}="${CSS.escape(a.value)}"]`).join("");
  return sel ? scope.querySelector(sel) : null;
}

export function useLegacyHtml(name) {
  const [tick_, bump] = useReducer((n) => n + 1, 0);
  const keep = useRef(null);
  useEffect(() => {
    const on = (e) => {
      if (!e.detail?.native) return;
      const a = document.activeElement;
      keep.current = a && a !== document.body && a.closest(`.page[data-screen="${name}"]`) ? a : null;
      bump();
    };
    document.addEventListener("reroute:rerender", on);
    return () => document.removeEventListener("reroute:rerender", on);
  }, [name]);
  useLayoutEffect(() => {
    if (!tick_) return;
    const page = document.querySelector(`.page[data-screen="${name}"]`);
    const a = keep.current;
    keep.current = null;
    if (page && a && !a.isConnected) {
      const t = twin(a, page);
      if (t) t.focus({ preventScroll: true });
      else { const lead = page.querySelector("h1, h2"); if (lead) { lead.tabIndex = -1; lead.focus({ preventScroll: true }); } }
    }
    const L = legacy();
    if (page && !L.isTransitioning()) { L.pageMounted(page, name); L.pageSettled(); } // mounts new map slots, drops dead ones
  }, [tick_, name]);
  return legacy().SCREENS[name]();
}

// snap when a search finishes with a plan, error when it fails (state.loading true -> false while this screen is shown).
export function useSearchHaptics() {
  const prev = useRef(legacy().state.loading);
  const s = legacy().state;
  useEffect(() => {
    if (prev.current && !s.loading) (s.error ? error : snap)();
    prev.current = s.loading;
  });
}
