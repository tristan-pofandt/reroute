"""Rewrite termsScreen/privacyScreen in app.js from web/src/screens/legal/*.body.jsx so the wording stays identical.
Run from apps/plan-b-mvp:  python web/scripts/sync_legacy_legal.py   (add --check to only compare; exit 1 if different)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def body(name):
    jsx = (ROOT / f"web/src/screens/legal/{name}.body.jsx").read_text(encoding="utf-8")
    text = jsx[jsx.index("(<>") + 4: jsx.index("  </>);")]
    text = text.replace("className=", "class=").replace("{PUSH_BIKE_MAX_KM}", "${PUSH_BIKE_MAX_KM}")
    assert "`" not in text
    return text


def fn(name, text):
    return f"function {name}() {{\n  return `${{navbar(true)}}<div class=\"scroll legal-content\">\n{text}  </div>`;\n}}\n\n"


def build(app):
    a = app.index("function termsScreen() {")
    acc = app.index("// The Account screen", a)
    acct = app[acc:app.index("\n}\n", acc) + 3] + "\n"
    return app[:a] + fn("termsScreen", body("terms")) + acct + fn("privacyScreen", body("privacy")) + app[app.index("function sourcesScreen()"):]


def main(check=False):
    path = ROOT / "app.js"
    app = path.read_bytes().decode("utf-8").replace("\r\n", "\n")
    new = build(app)
    if check:
        return new == app
    path.write_bytes(new.replace("\n", "\r\n").encode("utf-8"))
    return True


if __name__ == "__main__":
    ok = main("--check" in sys.argv)
    sys.exit(0 if ok else 1)
