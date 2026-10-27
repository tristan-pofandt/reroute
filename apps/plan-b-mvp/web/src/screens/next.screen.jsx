// Chosen route: confirmation, impact, step-by-step timeline, watch toggles and map. Figures and actions come from the legacy nextScreen()
// (which falls back to the results markup when no option is chosen).
import { createElement } from "react";
import { snap } from "../haptics.js";
import { toReact, useLegacyHtml } from "./trip/LegacyTree.jsx";
import { Rise } from "./trip/Rise.jsx";
import { Item } from "../shared.jsx";
import { resultsContainer, resultsCustom } from "./results.screen.jsx";

export default function Next() {
  const html = useLegacyHtml("next");
  const cards = resultsCustom();
  const custom = (ctx) => {
    const { tag, props, kids, el, index } = ctx;
    const cls = (c) => el.classList.contains(c);
    if (tag === "div" && (cls("confirm") || cls("impact-card") || cls("watch-banner") || cls("step"))) {
      return createElement(Rise, { key: `r${index}`, props, kids, index });
    }
    if (tag === "button" && props["data-action"] === "log-trip") return createElement(Item, { key: index, ...props, tag, index, onClick: snap }, kids);
    return cards(ctx);
  };
  // The step-by-step timeline and the cards list are transparent: their children are the staggered elements.
  const container = (el) => el.classList.contains("timeline") || resultsContainer(el);
  return <>{toReact(html, { custom, container })}</>;
}
