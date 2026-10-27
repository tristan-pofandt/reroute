// Route options. Cards, CO2 / cost figures, sorting, skeletons and error states come from the legacy resultsScreen(); the cards are
// React motion components (part of the page stagger). They are direct children of `.scroll` (the `.cards` wrapper is dissolved) so the
// motion layer's scroll reveal treats each one as its own block. Layout animation is on only for a moment after a sort or view change,
// never while scrolling (it made the cards float). A Cards | List toggle swaps the cards for compact rows; the choice is kept in localStorage.
import { cloneElement, createElement, isValidElement, useSyncExternalStore } from "react";
import { thud, tick } from "../haptics.js";
import { Item } from "../shared.jsx";
import { toReact, useLegacyHtml, useSearchHaptics } from "./trip/LegacyTree.jsx";
import { Rise } from "./trip/Rise.jsx";
import "./ambient.css";
import "./listview.css";

const KEY = "planb.resultsView";
let view = "cards";
try { if (localStorage.getItem(KEY) === "list") view = "list"; } catch { /* storage blocked */ }
let layoutOn = false, switchedAt = 0, timer = 0;
const subs = new Set();
const snapshot = () => view + layoutOn;
const emit = () => subs.forEach((f) => f());
const subscribe = (f) => (subs.add(f), () => subs.delete(f));
function animateLayout() { layoutOn = true; emit(); clearTimeout(timer); timer = setTimeout(() => { layoutOn = false; emit(); }, 900); }
function setView(v) {
  if (v === view) return;
  view = v; switchedAt = performance.now(); animateLayout();
  try { localStorage.setItem(KEY, v); } catch { /* storage blocked */ }
}

// The `.cards` list is transparent: each card is its own staggered element.
export const resultsContainer = (el) => el.classList.contains("cards");

const html = (el, sel) => el.querySelector(sel)?.outerHTML ?? "";
const text = (el, sel) => el.querySelector(sel)?.textContent.trim() ?? "";
const Raw = ({ tag = "span", className, html: h }) => createElement(tag, { className, dangerouslySetInnerHTML: { __html: h } });

// A compact row built from the legacy card's own markup: mode, name, arrival, status, then trip length / transfers, cost and CO2.
function rowOf(el, id, index, props, enter, layout) {
  const lowest = text(el, ".badge.outline");
  const co2 = lowest || text(el, ".co2-line b") || text(el, ".co2-mini span");
  const cost = text(el, ".stats span");
  const best = el.classList.contains("best") ? " best" : "";
  const body = (
    <button className="card-body" data-action="open-sheet" data-id={id} onClick={thud}>
      <Raw html={html(el, ".mode-tile")} tag="span" className="row-tile" />
      <span className="row-name">{text(el, ".card-name")}</span>
      <span className="row-end"><Raw html={html(el, ".card-head .badge")} /><span className="arrival-time">{text(el, ".arrival-time")}</span></span>
      <span className="row-meta">
        <span style={{ flex: "1 1 0" }}>{[text(el, ".card-sub"), cost].filter(Boolean).join(" · ")}</span>
        {co2 ? <span style={{ flex: "0 1 auto", display: "inline-flex", gap: 4, alignItems: "center", minWidth: 0 }}><Raw html={html(el, ".co2-line svg, .co2-mini svg")} /><span>{co2}</span></span> : null}
      </span>
    </button>
  );
  const { className: _c, ...rest } = props;
  return createElement(Rise, { key: `list-${id}`, tag: "article", props: { ...rest, className: `card card-row${best}` }, kids: body, index, layout, tap: true, enter });
}

export function resultsCustom(layout = false, list = false) {
  return ({ tag, props, kids, el, index }) => {
    if (tag === "div" && "viewToggle" in el.dataset) return createElement(Item, { key: index, ...props, tag, index }, createElement(ViewToggle));
    if (tag === "article" && el.classList.contains("card")) {
      const id = el.querySelector("[data-id]")?.dataset.id ?? `c${index}`;
      const enter = performance.now() - switchedAt < 700;
      if (list && view === "list") return rowOf(el, id, index, props, enter, layout);
      return createElement(Rise, { key: `card-${id}`, tag, props, kids, index, layout, tap: true, enter });
    }
    if (tag === "button" && props["data-action"] === "sort") return createElement(tag, { key: index, ...props, onClick: () => { animateLayout(); tick(); } }, kids);
    if (tag === "button" && el.classList.contains("card-body")) return createElement(tag, { key: index, ...props, onClick: thud }, kids);
  };
}

function ViewToggle() {
  useSyncExternalStore(subscribe, snapshot);
  const b = (v, label) => <button type="button" aria-pressed={view === v} onClick={() => { if (view !== v) { tick(); setView(v); } }}>{label}</button>;
  return <div className="segmented" role="group" aria-label="Results layout">{b("cards", "Cards")}{b("list", "List")}</div>;
}

// Dissolve `.cards` (not the loading skeleton, which is a status region) into its parent so cards are direct children of `.scroll`.
function flatten(nodes) {
  return nodes.map((n) => {
    if (!isValidElement(n) || !String(n.props.className || "").split(" ").includes("scroll")) return n;
    const kids = [].concat(n.props.children ?? []).flatMap((c) => (isValidElement(c) && c.props.className === "cards" && !c.props.role ? [].concat(c.props.children ?? []) : [c]));
    return cloneElement(n, undefined, ...kids);
  });
}

export default function Results() {
  const html_ = useLegacyHtml("results");
  useSearchHaptics();
  useSyncExternalStore(subscribe, snapshot);
  return <>{flatten(toReact(html_, { custom: resultsCustom(layoutOn, true), container: resultsContainer }))}</>;
}
