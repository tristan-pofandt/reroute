// Chosen route: confirmation, impact, step-by-step timeline, watch toggles and map. Figures and actions come from the legacy nextScreen()
// (which falls back to the results markup when no option is chosen).
import { createElement } from "react";
import { snap } from "../haptics.js";
import { toReact, useLegacyHtml } from "./trip/LegacyTree.jsx";
import { Rise } from "./trip/Rise.jsx";
import { resultsCustom } from "./results.screen.jsx";

export default function Next() {
  const html = useLegacyHtml("next");
  let n = 0;
  const cards = resultsCustom();
  const custom = (ctx) => {
    const { tag, props, kids, el, index } = ctx;
    const cls = (c) => el.classList.contains(c);
    if (tag === "div" && (cls("confirm") || cls("impact-card") || cls("watch-banner") || cls("step"))) {
      return createElement(Rise, { key: `r${index}`, props, kids, delay: 0.1 + Math.min(n++, 10) * 0.05 });
    }
    if (tag === "button" && props["data-action"] === "log-trip") return createElement(tag, { key: index, ...props, onClick: snap }, kids);
    return cards(ctx);
  };
  return <>{toReact(html, { custom })}</>;
}
