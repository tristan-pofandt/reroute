// Pauses the ambient loops (screens/ambient.css) of blocks that are scrolled out of view: an IntersectionObserver on the scroll blocks toggles
// `.amb-off`. Hidden tabs already stop painting; reduced motion tears the whole layer down (MotionLayer), which removes the class again.
const BLOCKS = ".scroll > *, .sheet-scroll > *";
export function installAmbient(viewport) {
  const io = new IntersectionObserver((list) => list.forEach((e) => e.target.classList.toggle("amb-off", !e.isIntersecting)), { rootMargin: "80px" });
  const seen = new Set();
  const scan = () => viewport.querySelectorAll(BLOCKS).forEach((el) => { if (!seen.has(el)) { seen.add(el); io.observe(el); } });
  scan();
  return {
    scan,
    stop() { io.disconnect(); seen.forEach((el) => el.classList.remove("amb-off")); seen.clear(); },
  };
}
