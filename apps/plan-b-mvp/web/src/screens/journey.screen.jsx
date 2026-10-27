// Plan a trip. Markup, validation messages, autocomplete and every data-action come from the legacy journeyScreen(); see trip/LegacyTree.
import { createElement } from "react";
import { toReact, useLegacyHtml, useSearchHaptics } from "./trip/LegacyTree.jsx";
import { Rise } from "./trip/Rise.jsx";

// The From/To group is rewritten in place by the legacy paintOrigin() and autocomplete, so it stays an island.
const island = (el) => el.matches(".group-card") && el.querySelector("[data-origin-row]");

export default function Journey() {
  const html = useLegacyHtml("journey");
  useSearchHaptics();
  let n = 0;
  const custom = ({ tag, props, kids, el }) => {
    if (tag === "div" && el.classList.contains("group")) {
      const i = n++;
      return createElement(Rise, { key: `g${i}`, props, kids, delay: 0.1 + i * 0.06 });
    }
  };
  return <>{toReact(html, { island, custom })}</>;
}
