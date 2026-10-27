// Shared layout: elements that persist across screens carry a framer-motion `layoutId` (inside the router's <LayoutGroup>), so they
// physically morph from one screen's box to the next instead of leaving and re-entering.
//
//   impact    the home Impact button  <->  the dashboard lead figure
//   nav-back  the Back button on every page with a navbar
//   nav-home  the Home button on every page with a navbar
//   title     the large page title
//
// Rules: (1) a shared element is rendered as <Shared id>, never as a staggered <Item>, so it takes no part in its screen's stagger out or
// in: the elements around it stagger, it morphs. (2) A container that holds a shared element is not itself animated (it would carry the
// shared element with it); its other children are staggered individually instead. Both rules are applied by `legacyNode()` below when
// legacy HTML is turned into React, and by hand in the hand-written screens (Navbar, weather, legal).
import { createElement } from "react";
import { motion } from "framer-motion";
import { slow, staggerProps } from "./choreography.js";

const SHARED = [
  [".impact-btn, .kpi.lead", "impact"],
  [".nav-back", "nav-back"],
  [".home-btn", "nav-home"],
  [".large-title", "title"],
];
export const sharedId = (el) => SHARED.find(([sel]) => el.matches(sel))?.[1];
export const holdsShared = (el) => SHARED.some(([sel]) => el.querySelector(sel));

// A persistent element. Titles move but are never stretched (their text changes between screens); buttons may change size.
export function Shared({ tag = "div", id, ...props }) {
  return createElement(motion[tag], {
    ...props,
    layoutId: id,
    layout: id === "title" ? "position" : true,
    transition: { layout: { type: "spring", duration: 0.55 * slow(), bounce: 0.14 } },
  });
}

// A staggered element: `index` is its position among its siblings (past the cap it fades with the group).
export function Item({ tag = "div", index = 0, ...props }) {
  const T = motion[tag];
  return T ? createElement(T, { ...props, ...staggerProps(index) }) : createElement(tag, props);
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
