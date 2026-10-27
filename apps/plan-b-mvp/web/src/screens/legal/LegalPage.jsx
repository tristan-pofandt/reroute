import { motion } from "framer-motion";
import { Navbar } from "./Chrome.jsx";
import { useReducedMotion } from "../../reduced.js";

// A legal page: navbar plus the `.scroll.legal-content` column (text lives in the *.body.jsx files, verbatim from the legacy screens).
export default function LegalPage({ children }) {
  const reduced = useReducedMotion();
  return (
    <>
      <Navbar />
      <motion.div className="scroll legal-content" initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}>
        {children}
      </motion.div>
    </>
  );
}
