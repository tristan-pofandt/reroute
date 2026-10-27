// Pieces shared by the legal and weather screens: the legacy icon set (data generated from app.js) and the page navbar.
import data from "./iconData.js";

export function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size < 16 ? 2.1 : 1.75}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: data[name] }} />
  );
}

// Same markup as the legacy navbar(true): Back and Home are handled by the global data-action delegation.
export function Navbar() {
  return (
    <header className="navbar">
      <div className="side"><button className="nav-back" data-action="back" aria-label="Back"><Icon name="chevronLeft" size={20} /><span>Back</span></button></div>
      <div className="side end"><button className="home-btn" data-action="go-home" aria-label="Go straight to the home screen" title="Home"><Icon name="home" size={18} /><span>Home</span></button></div>
    </header>
  );
}
