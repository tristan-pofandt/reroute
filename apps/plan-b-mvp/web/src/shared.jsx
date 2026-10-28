// Shared layout: elements that persist across screens carry a framer-motion `layoutId` (inside the router's <LayoutGroup>), so they
// physically morph from one screen's box to the next instead of leaving and re-entering.
//
//   impact    the home Impact button  <->  the dashboard lead figure
//   nav-back  the Back button on every page with a navbar
//   nav-home  the Home button on every page with a navbar
//   title     the large page title
//
// Rules: (1) a shared element morphs ONLY when its counterpart exists on the screen being navigated to/from (`hasShared`); then it takes no
// part in the stagger (it is "exempt", Page.jsx skips it) and the elements around it stagger. When the other screen has no counterpart
// (the Impact button going to Weather, or to a dashboard with no trips and so no lead figure; Back/Home going to a screen drawn by the
// legacy HTML) nothing could morph, so it is an ordinary Item: it slides and fades with the travel direction, in DOM order, like its
// neighbours. (2) A container that holds a shared element is not itself animated (it would carry the element away); its other children
// are staggered individually instead. Both rules are applied by `legacyNode()` below when legacy HTML is turned into React, and by hand in
// the hand-written screens (Navbar, weather, legal).
// Every element that takes part in a page transition carries `data-item` (Item and Shared); Shared also carries `data-shared`.
import { createElement, useState } from "react";
import { motion } from "framer-motion";
import { MORPH } from "./choreography.js";

const SHARED = [
  [".impact-btn, .kpi.lead", "impact"],
  [".nav-back", "nav-back"],
  [".home-btn", "nav-home"],
  [".large-title", "title"],
];
export const sharedId = (el) => SHARED.find(([sel]) => el.matches(sel))?.[1];
export const holdsShared = (el) => SHARED.some(([sel]) => el.querySelector(sel));

// Where the previous / next screen is: set by the router (Routes.jsx) when the shown screen changes, before anything renders.
export const nav = { from: null, to: null, id: 0 };
export const setNav = (from, to) => { nav.from = from; nav.to = to; nav.id++; };
const CLASS = { impact: /class="[^"]*(?:impact-btn|kpi lead)/, "nav-back": /class="[^"]*nav-back/, "nav-home": /class="[^"]*home-btn/, title: /class="[^"]*large-title/ };
const htmlOf = new Map(); // "navId:screen" -> markup, so a transition reads each screen's markup once
// Does `screen` render a shared element `id`? Only native screens carry layoutId elements (legacy innerHTML screens cannot), and the
// markup says whether the element exists right now (the dashboard has a lead figure only once a trip is logged).
export function hasShared(screen, id) {
  if (!screen || !window.RerouteBridge?.isNative(screen)) return false;
  const key = `${nav.id}:${screen}`;
  let html = htmlOf.get(key);
  if (html === undefined) {
    if (htmlOf.size > 8) htmlOf.clear();
    try { html = window.RerouteLegacy.SCREENS[screen]() || ""; } catch { html = ""; }
    htmlOf.set(key, html);
  }
  return CLASS[id].test(html);
}

// layoutId namespaces: a shared element reuses the previous screen's namespace only when that screen has the counterpart. Otherwise it
// gets a fresh one, because framer keeps the last box of a removed layoutId node and would morph an unrelated new node out of it.
const space = {};
let seq = 0;
const claim = (id) => { const n = hasShared(nav.from, id) && space[id] ? space[id] : ++seq; space[id] = n; return n; };

// A persistent element. Titles move but are never stretched (their text changes between screens); buttons may change size.
export function Shared({ tag = "div", id, ...props }) {
  const [n] = useState(() => claim(id));
  return createElement(motion[tag], {
    ...props,
    "data-item": "",
    "data-shared": id,
    layoutId: `${id}~${n}`,
    layout: id === "title" ? "position" : true,
    transition: { layout: MORPH() },
  });
}

// A staggered element (Page.jsx slides every `data-item` in DOM order; past the cap it fades with the group).
export function Item({ tag = "div", index, ...props }) {
  return createElement(tag, { ...props, "data-item": "" });
}

// Legacy HTML node -> React element for the screen tree. `target` is true for the direct children of a page's header and `.scroll`
// (the elements that take part in the stagger). `kids(node, target)` converts a node's children and is supplied by the caller, since
// each converter (home/tree.jsx, trip/LegacyTree.jsx) has its own attribute handling.
export function legacyNode(node, p, index, target, kids) {
  const tag = node.localName, id = sharedId(node);
  if (id) return createElement(Shared, { ...p, tag, id }, ...kids(node, false));
  if (!target) return null;
  if (holdsShared(node)) return createElement(tag, p, ...kids(node, true));
  return createElement(Item, { ...p, tag, index }, ...kids(node, false));
}
