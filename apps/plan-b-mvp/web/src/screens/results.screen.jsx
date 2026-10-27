// Route options. Cards, CO2 / cost figures, sorting, skeletons and error states come from the legacy resultsScreen(); the cards are
// React motion components (stagger on landing, layout animation when the sort reorders them).
import { createElement } from "react";
import { thud, tick } from "../haptics.js";
import { toReact, useLegacyHtml, useSearchHaptics } from "./trip/LegacyTree.jsx";
import { Rise } from "./trip/Rise.jsx";

export function resultsCustom() {
  let cards = 0;
  return ({ tag, props, kids, el, index }) => {
    if (tag === "article" && el.classList.contains("card")) {
      const id = el.querySelector("[data-id]")?.dataset.id ?? `c${index}`;
      return createElement(Rise, { key: id, tag, props, kids, delay: 0.12 + cards * 0.055, layout: true, tap: true, land: cards++ === 0 });
    }
    if (tag === "button" && props["data-action"] === "sort") return createElement(tag, { key: index, ...props, onClick: tick }, kids);
    if (tag === "button" && el.classList.contains("card-body")) return createElement(tag, { key: index, ...props, onClick: thud }, kids);
  };
}

export default function Results() {
  const html = useLegacyHtml("results");
  useSearchHaptics();
  return <>{toReact(html, { custom: resultsCustom() })}</>;
}
