"""Verify checkout form structure using an isolated synthetic staging cart.

This adds the supplied QA product to a disposable cookie session. It does not
submit checkout, create an order, or make a payment.
"""

import argparse
import http.cookiejar
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser


class CheckoutForms(HTMLParser):
    def __init__(self):
        super().__init__()
        self.forms = []
        self.current = None

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if tag == "form":
            self.current = {"class": attributes.get("class", ""), "fields": []}
            self.forms.append(self.current)
        if tag in ("input", "select", "textarea") and self.current is not None:
            self.current["fields"].append(attributes.get("name"))

    def handle_endtag(self, tag):
        if tag == "form":
            self.current = None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="Dedicated HTTPS staging origin")
    parser.add_argument("--product-id", required=True, type=int, help="Hidden synthetic QA product ID")
    parser.add_argument("--checkout-path", default="/checkout/")
    arguments = parser.parse_args()
    origin = urllib.parse.urlsplit(arguments.url)
    if (
        origin.scheme != "https"
        or not re.fullmatch(r"(?:qa|staging|test)[a-z0-9-]*\.villa-claudia\.eu", origin.hostname or "")
        or origin.username
        or origin.password
        or origin.query
        or origin.fragment
        or origin.path not in ("", "/")
        or arguments.product_id < 1
        or not arguments.checkout_path.startswith("/")
        or arguments.checkout_path.startswith("//")
    ):
        parser.error("Use a dedicated Villa Claudia staging origin and a synthetic product.")

    base = arguments.url.rstrip("/")
    session = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
    )
    session.open(base + "/?" + urllib.parse.urlencode({"add-to-cart": arguments.product_id}), timeout=30).read()
    response = session.open(base + arguments.checkout_path, timeout=30)
    forms = CheckoutForms()
    forms.feed(response.read().decode("utf-8"))
    checkout = [form for form in forms.forms if "checkout" in form["class"].split()]
    result = {
        "http_status": response.status,
        "checkout_form_count": len(checkout),
        "billing_address_field_count": sum(form["fields"].count("billing_address_1") for form in forms.forms),
        "billing_and_payment_share_form": any(
            "billing_address_1" in form["fields"] and "payment_method" in form["fields"]
            for form in checkout
        ),
    }
    print(json.dumps(result, indent=2))
    if not (
        result["http_status"] == 200
        and result["checkout_form_count"] == 1
        and result["billing_address_field_count"] == 1
        and result["billing_and_payment_share_form"]
    ):
        raise SystemExit("Checkout contains missing or duplicate billing/payment forms.")


if __name__ == "__main__":
    main()
