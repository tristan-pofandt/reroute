// An element from the legacy markup that lands with a fade and lift (staggered by `delay`), animates its position when the list around it
// reorders (`layout`), and optionally gives a haptic when the first one lands. Legacy CSS entrance animations/transitions on the same
// properties are switched off so they do not fight framer-motion.
import { createElement, useRef } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "../../reduced.js";
import { thud } from "../../haptics.js";

export function Rise({ tag = "div", props, kids, delay = 0, layout = false, land = false, tap = false }) {
  const reduced = useReducedMotion();
  const done = useRef(false);
  const { style, ...rest } = props;
  return createElement(motion[tag], {
    ...rest,
    style: { ...style, animation: "none", transitionProperty: "background-color, border-color, color, box-shadow" },
    layout: layout && !reduced ? "position" : false,
    initial: reduced ? false : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: reduced ? { duration: 0 } : { delay, type: "spring", stiffness: 380, damping: 32, mass: 0.8, layout: { type: "spring", stiffness: 420, damping: 36 } },
    whileTap: tap && !reduced ? { scale: 0.985 } : undefined,
    onAnimationComplete: () => { if (land && !done.current) { done.current = true; thud(); } },
  }, kids);
}
