import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { toReact } from "../screens/trip/LegacyTree.jsx";

const render = (html, opts) => renderToStaticMarkup(<>{toReact(html, opts)}</>);

describe("legacy HTML to React (toReact)", () => {
  it("keeps classes, data-actions, aria attributes and roles", () => {
    const out = render('<button class="btn primary" data-action="go" aria-label="Go now" role="link" tabindex="0">Go</button>');
    expect(out).toContain('class="btn primary"');
    expect(out).toContain('data-action="go"');
    expect(out).toContain('aria-label="Go now"');
    expect(out).toContain('role="link"');
    expect(out).toContain('tabindex="0"');
  });
  it("keeps label association", () => {
    const out = render('<label for="a">Name</label><input id="a" name="n">');
    expect(out).toContain('for="a"');
    expect(out).toContain('id="a"');
  });
  it("turns inline style strings into style objects, keeping custom properties", () => {
    const out = render('<div style="--x: 3px; margin-top: 4px">a</div>');
    expect(out).toContain("--x:3px");
    expect(out).toContain("margin-top:4px");
  });
  it("renders boolean attributes and text", () => {
    const out = render("<button disabled hidden>Hi &amp; bye</button>");
    expect(out).toContain("disabled");
    expect(out).toContain("hidden");
    expect(out).toContain("Hi &amp; bye");
  });
  it("hands the direct children of .scroll to the page stagger (data-item)", () => {
    const out = render('<div class="scroll"><section class="a">x</section></div>');
    expect(out).toContain('class="a"');
    expect(out).toContain("data-item");
  });
});
