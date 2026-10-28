"""Ride-board content filter: a word list plus rules that stop contact details, links and scam hooks being posted.

Deliberately simple (whole-word matching after normalising look-alike characters). It reduces abuse; it is not a substitute for
the report button and the operator queue. See docs/engineering/ride-board-moderation.md.
"""

from pathlib import Path
import re
import unicodedata

HERE = Path(__file__).resolve().parent
LEET = str.maketrans("013457@$!|", "oieastasii")
SUFFIXES = ("", "s", "es", "ed", "d", "er", "ers", "ing", "in", "y")
DIGIT_WORDS = {"zero", "oh", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ate", "for", "to", "too", "won"}
URL = re.compile(r"https?://|www\.|\b[a-z0-9-]+\.(?:com|net|org|au|io|me|co|app|ly|gl|link|xyz|info|biz|us|uk|nz|ru|cn|tk|ml)\b|\bt\.me/|\bbit\.ly", re.I)
EMAIL = re.compile(r"[\w.+-]+\s?@\s?[\w-]+\s?\.\s?[\w.]+|(?:^|\s)@[a-z0-9_.]{3,}", re.I)
PHONE = re.compile(r"(?:\+?\d[\s().-]?){8,}")
MESSAGES = {"abuse": "That wording is not allowed on the ride board. Keep posts friendly and about the trip.",
            "contact": "Don't put phone numbers, links, email addresses or social handles in a post. Meet at a public point and use the app."}


def normalise(text):
    """Lower-case words with accents removed and look-alike characters undone."""
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode().lower().translate(LEET)
    text = re.sub(r"(.)\1{2,}", r"\1\1", text)  # fuuuuck -> fuuck
    return re.sub(r"[^a-z0-9]+", " ", text).split()


def _join_spaced(tokens):
    """['f', 'u', 'c', 'k', 'you'] -> ['fuck', 'you']: runs of three or more single letters are one word."""
    out, run = [], []
    for token in tokens + [""]:
        if len(token) == 1 and token.isalpha():
            run.append(token)
            continue
        if len(run) >= 3:
            out.append("".join(run))
        else:
            out.extend(run)
        run = []
        if token:
            out.append(token)
    return out


def _fold(word):
    return re.sub(r"(.)\1+", r"\1", word)


class ContentFilter:
    def __init__(self, paths=None):
        self.abuse, self.contact = set(), set()
        paths = paths or [HERE / "moderation" / "wordlist.txt", HERE / "data" / "wordlist.extra.txt"]
        for path in paths:
            self.load(path)

    def load(self, path):
        section = self.abuse
        try:
            lines = Path(path).read_text(encoding="utf-8").splitlines()
        except OSError:
            return
        for line in lines:
            line = line.strip().lower()
            if not line or line.startswith("#"):
                continue
            if line in ("[abuse]", "[scam-contact]"):
                section = self.abuse if line == "[abuse]" else self.contact
                continue
            section.add(" ".join(normalise(line)))

    @staticmethod
    def _hit(words, padded, tokens):
        for entry in words:
            if " " in entry:
                if f" {entry} " in padded:
                    return True
                continue
            folded = _fold(entry)
            for token in tokens:
                if any(token == entry + suffix for suffix in SUFFIXES):
                    return True
                if len(folded) >= 4 and any(_fold(token) == folded + suffix for suffix in SUFFIXES):
                    return True
        return False

    def reason(self, text):
        """'abuse', 'contact' or None for a piece of free text."""
        if not text:
            return None
        raw = str(text)
        if URL.search(raw) or EMAIL.search(raw) or PHONE.search(raw):
            return "contact"
        tokens = _join_spaced(normalise(raw))
        # spoken digits ("oh four one two ...") are a phone number too
        run = best = 0
        for token in tokens:
            run = run + 1 if token in DIGIT_WORDS or token.isdigit() else 0
            best = max(best, run)
        if best >= 7:
            return "contact"
        padded = " " + " ".join(tokens) + " "
        if self._hit(self.contact, padded, tokens):
            return "contact"
        if self._hit(self.abuse, padded, tokens):
            return "abuse"
        return None

    def message(self, text):
        """The message to show the poster, or None when the text is fine."""
        found = self.reason(text)
        return MESSAGES[found] if found else None
