// Pieces shared by the legal and weather screens: the legacy icon set (data generated from app.js) and the page navbar.
import data from "./iconData.js";
import { Shared } from "../../shared.jsx";

export function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size < 16 ? 2.1 : 1.75}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: data[name] }} />
  );
}

// Same markup as the legacy navbar(true): Back and Home are handled by the global data-action delegation. Both are persistent
// elements (layoutId), so they stay put between pages instead of leaving and re-entering.
export function Navbar() {
  return (
    <header className="navbar">
      <div className="side"><Shared tag="button" id="nav-back" className="nav-back" data-action="back" aria-label="Back"><Icon name="chevronLeft" size={20} /><span>Back</span></Shared></div>
      <div className="side end"><Shared tag="button" id="nav-home" className="home-btn" data-action="go-home" aria-label="Go straight to the home screen" title="Home"><Icon name="home" size={18} /><span>Home</span></Shared></div>
    </header>
  );
}
