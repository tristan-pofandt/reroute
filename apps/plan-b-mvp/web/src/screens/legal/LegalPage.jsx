import { Children } from "react";
import { Navbar } from "./Chrome.jsx";
import { Item, Shared } from "../../shared.jsx";

// A legal page: navbar plus the `.scroll.legal-content` column. The text lives in the *.body.jsx files (verbatim from the legacy screens);
// each is a hook-free component returning a fragment, so its elements are read here and become the page's staggered Items. The title is
// the persistent `title` element (layoutId) instead.
export default function LegalPage({ children }) {
  const body = Children.toArray(children.type(children.props).props.children);
  return (
    <>
      <Navbar />
      <div className="scroll legal-content">
        {body.map((el, i) => (typeof el === "string" ? el
          : el.props.className === "large-title" ? <Shared key={el.key} tag={el.type} id="title" {...el.props} />
          : <Item key={el.key} tag={el.type} index={i} {...el.props} />))}
      </div>
    </>
  );
}
