"""Settings, Themes: every palette in app.css keeps readable contrast, and app.js and the two theme bootstraps agree on the palette list.

Thresholds are WCAG 2.2 AA: 4.5:1 for text (main, muted, links, status text, text on the accent) and 3:1 for the accent and icon tones
against each surface. Faint text is decorative (placeholders sit on muted), so it only has to stay visible at 2.5:1, like Original's.
"""

import re
import unittest
from pathlib import Path

HERE = Path(__file__).parent
SOFT_ACCENT = {"matcha"}  # deliberate: Matcha's soft light-green fill sits below 3:1 on cream; its text, links and focus ring use --accent-text
STATUS_TEXT = {"light": ("#065F46", "#B91C1C", "#92400E"), "dark": ("#6EE7B7", "#FCA5A5", "#FCD34D")}  # success, error, warning text per base


def read(name):
    return (HERE / name).read_text(encoding="utf-8")


def luminance(hex_colour):
    channels = [int(hex_colour.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    r, g, b = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    high, low = sorted((luminance(a), luminance(b)), reverse=True)
    return (high + 0.05) / (low + 0.05)


def css_palettes():
    rules = re.findall(r':is\(:root, \.theme-swatch\)\[data-palette="(\w+)"\] \{([^}]*)\}', read("app.css"))
    return {pid: dict(re.findall(r"--([\w-]+): (#[0-9A-Fa-f]{6})", body)) for pid, body in rules}


def js_palettes():
    block = re.search(r"const PALETTES = \[(.*?)\];", read("app.js"), re.S).group(1)
    return re.findall(r'\["(\w+)", "([^"]+)", "(\w*)"\]', block)


class PaletteTests(unittest.TestCase):
    def test_sixteen_palettes_with_original_first(self):
        palettes = js_palettes()
        self.assertEqual(len(palettes), 16)
        self.assertEqual(palettes[0], ("original", "Original", ""))
        self.assertEqual({pid for pid, _, _ in palettes[1:]}, set(css_palettes()))

    def test_bootstraps_know_which_palettes_are_dark(self):
        dark = sorted(pid for pid, _, base in js_palettes() if base == "dark")
        for page in ("index.html", "web/index.html"):
            listed = re.search(r"\[((?:\"\w+\", )*\"\w+\")\]\.includes\(palette\)", read(page)).group(1)
            self.assertEqual(sorted(re.findall(r'"(\w+)"', listed)), dark, page)

    def test_contrast(self):
        bases = {pid: base for pid, _, base in js_palettes()}
        for pid, c in css_palettes().items():
            for surface in ("bg-base", "bg-surface", "bg-card"):
                bg = c[surface]
                checks = [("text-main", 4.5), ("text-muted", 4.5), ("accent-text", 4.5), ("text-faint", 2.5), ("teal", 3), ("violet", 3)]
                if pid not in SOFT_ACCENT:
                    checks.append(("accent", 3))
                for token, minimum in checks:
                    with self.subTest(palette=pid, token=token, on=surface):
                        self.assertGreaterEqual(contrast(c[token], bg), minimum)
                for status in STATUS_TEXT[bases[pid]]:
                    with self.subTest(palette=pid, status=status, on=surface):
                        self.assertGreaterEqual(contrast(status, bg), 4.5)
            with self.subTest(palette=pid, token="on-accent"):
                self.assertGreaterEqual(contrast(c["on-accent"], c["accent"]), 4.5)


if __name__ == "__main__":
    unittest.main()
