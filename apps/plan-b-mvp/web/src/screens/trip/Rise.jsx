// An element from the legacy markup that takes part in the page choreography (staggered by `index` like every Item, see shared.jsx),
// animates its position when the list around it reorders (`layout`), and optionally sinks slightly when pressed. Legacy CSS entrance
// animations/transitions on the same properties are switched off so they do not fight framer-motion.
// `enter`: the element was mounted by a view switch mid-page (no page stagger runs then), so it fades and rises in by itself.
import { createElement } from "react";
import { motion } from "framer-motion";
import { DUR, EASE, LAYOUT, STAGGER_IN, slow } from "../../choreography.js";
import { useReducedMotion } from "../../reduced.js";

export function Rise({ tag = "div", props, kids, index = 0, layout = false, tap = false, enter = false }) {
  const reduced = useReducedMotion();
  const { style, ...rest } = props;
  const own = enter && !reduced
    ? { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: DUR.rise * slow(), ease: EASE, delay: Math.min(index, 6) * STAGGER_IN * slow() } }
    : { transition: reduced ? { duration: 0 } : { layout: LAYOUT } };
  return createElement(motion[tag], {
    ...rest,
    ...(enter ? null : { "data-item": "" }),
    style: { ...style, animation: "none", transitionProperty: "background-color, border-color, color, box-shadow" },
    layout: layout && !reduced ? "position" : false,
    whileTap: tap && !reduced ? { scale: 0.985 } : undefined,
    ...own,
  }, kids);
}
