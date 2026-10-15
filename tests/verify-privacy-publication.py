"""Compare the published privacy text with the canonical bilingual content.

Anonymous HTTP GETs only. Policy bodies must use the wrapper IDs
villa-privacy-policy-en and villa-privacy-policy-de on both sites.
"""

import argparse
import hashlib
import json
import re
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


VOID_ELEMENTS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


class PolicyText(HTMLParser):
    def __init__(self, wrapper=None):
        super().__init__(convert_charrefs=True)
        self.wrapper = wrapper
        self.stack = []
        self.parts = []
        self.matches = 0

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if self.wrapper and attributes.get("id") == self.wrapper:
            self.matches += 1
            if self.stack:
                raise ValueError("Nested duplicate policy wrappers.")
            self.stack = [tag]
        elif self.stack and tag not in VOID_ELEMENTS:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if self.stack and tag in self.stack:
            position = len(self.stack) - 1 - self.stack[::-1].index(tag)
            self.stack = self.stack[:position]

    def handle_data(self, data):
        if self.wrapper is None or self.stack:
            self.parts.append(data)

    def text(self):
        if self.wrapper and self.matches != 1:
            raise ValueError("Expected exactly one privacy policy wrapper.")
        return re.sub(r"\s+", " ", " ".join(self.parts)).strip()


def normalized_text(html, wrapper=None):
    parser = PolicyText(wrapper)
    parser.feed(html)
    return parser.text()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--next-base", required=True)
    parser.add_argument("--wordpress-en", required=True)
    parser.add_argument("--wordpress-de", required=True)
    parser.add_argument("--content", type=Path, default=Path(__file__).resolve().parents[1] / "content" / "privacy-policy.json")
    arguments = parser.parse_args()
    content = json.loads(arguments.content.read_text(encoding="utf-8"))
    if content["status"] != "published":
        raise SystemExit("Approved canonical policy content must be supplied before publication verification.")

    targets = [
        ("en", arguments.wordpress_en),
        ("de", arguments.wordpress_de),
        ("en", arguments.next_base.rstrip("/") + "/privacy"),
        ("de", arguments.next_base.rstrip("/") + "/privacy/de"),
    ]
    receipts = []
    for language, url in targets:
        expected_html = content["languages"][language]["html"]
        expected = normalized_text(expected_html)
        if not expected:
            raise SystemExit("Canonical privacy text is empty.")
        request = urllib.request.Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "VillaClaudia-PrivacyVerification/1.0"})
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status != 200:
                raise SystemExit("Published policy did not return HTTP 200.")
            actual = normalized_text(response.read().decode("utf-8"), "villa-privacy-policy-" + language)
        matches = actual == expected
        receipts.append({
            "language": language,
            "url": url,
            "matches_canonical_text": matches,
            "canonical_html_sha256": hashlib.sha256(expected_html.encode("utf-8")).hexdigest(),
            "published_text_sha256": hashlib.sha256(actual.encode("utf-8")).hexdigest(),
        })
        if not matches:
            print(json.dumps(receipts, indent=2))
            raise SystemExit("Published privacy text differs from the canonical policy.")
    print(json.dumps(receipts, indent=2))


if __name__ == "__main__":
    main()
