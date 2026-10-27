// Route options. Cards, CO2 / cost figures, sorting, skeletons and error states come from the legacy resultsScreen(); the cards are
// React motion components (part of the page stagger, layout animation when the sort reorders them).
import { createElement } from "react";
import { thud, tick } from "../haptics.js";
import { toReact, useLegacyHtml, useSearchHaptics } from "./trip/LegacyTree.jsx";
import { Rise } from "./trip/Rise.jsx";

// The `.cards` list is transparent: each card is its own staggered element.
export const resultsContainer = (el) => el.classList.contains("cards");

export function resultsCustom() {
  return ({ tag, props, kids, el, index }) => {
    if (tag === "article" && el.classList.contains("card")) {
      const id = el.querySelector("[data-id]")?.dataset.id ?? `c${index}`;
      return createElement(Rise, { key: id, tag, props, kids, index, layout: true, tap: true });
    }
    if (tag === "button" && props["data-action"] === "sort") return createElement(tag, { key: index, ...props, onClick: tick }, kids);
    if (tag === "button" && el.classList.contains("card-body")) return createElement(tag, { key: index, ...props, onClick: thud }, kids);
  };
}

export default function Results() {
  const html = useLegacyHtml("results");
  useSearchHaptics();
  return <>{toReact(html, { custom: resultsCustom(), container: resultsContainer })}</>;
}
