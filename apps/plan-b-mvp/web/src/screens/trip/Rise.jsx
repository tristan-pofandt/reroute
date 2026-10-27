// An element from the legacy markup that takes part in the page choreography (staggered by `index` like every Item, see shared.jsx),
// animates its position when the list around it reorders (`layout`), and optionally sinks slightly when pressed. Legacy CSS entrance
// animations/transitions on the same properties are switched off so they do not fight framer-motion.
import { createElement } from "react";
import { motion } from "framer-motion";
import { staggerProps } from "../../choreography.js";
import { useReducedMotion } from "../../reduced.js";

export function Rise({ tag = "div", props, kids, index = 0, layout = false, tap = false }) {
  const reduced = useReducedMotion();
  const { style, ...rest } = props;
  return createElement(motion[tag], {
    ...rest,
    ...staggerProps(index),
    style: { ...style, animation: "none", transitionProperty: "background-color, border-color, color, box-shadow" },
    layout: layout && !reduced ? "position" : false,
    transition: reduced ? { duration: 0 } : { layout: { type: "spring", stiffness: 420, damping: 36 } },
    whileTap: tap && !reduced ? { scale: 0.985 } : undefined,
  }, kids);
}
