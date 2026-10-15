# Villa Claudia privacy defaults

This WordPress plugin disables optional visitor tracking while preserving booking, cart, payment and administrator account connections. It blocks Site Kit analytics and advertising tags, Hostinger Reach visitor scripts and WooCommerce collection/automation callbacks, Woo attribution and optional WooPayments shopper tracking. It does not disconnect these services or change their saved credentials.

Divi's automatic Google Maps module becomes a bilingual external directions link. Google receives a visitor's connection only after that visitor opens the link. The existing Poppins, Roboto and Roboto Condensed faces are bundled locally. `assets/fonts-manifest.json` records the original public URLs, byte counts and SHA-256 checksums. The corresponding Open Font License files are included.

The plugin links published WordPress pages with the slugs `privacy-policy` and `datenschutz`. TranslatePress German visitors receive `/de/datenschutz/`; other visitors receive `/privacy-policy/`. An unpublished German page falls back to published English. Missing or draft policies do not produce a footer link or reservation notice. MotoPress contact fields receive a bilingual contextual policy link through its native hook. WooCommerce's checkout explanation retains its native `[privacy_policy]` replacement.

## Installation and rollback

1. Back up the active plugin list and the site's generated-resource settings privately.
2. Upload this folder as `wp-content/plugins/villa-claudia-privacy` and activate it on QA first.
3. Clear Divi's Google Fonts cache and generated CSS through its native controls. Clear the page cache for that environment.
4. Inspect fresh anonymous EN/DE home, location, booking and checkout sessions. Check network requests, cookies, storage, map explanation and font loading. Complete the isolated booking/payment test before production deployment.
5. Activate the same reviewed files on production and repeat the anonymous checks.

To roll back, deactivate the plugin, then clear the same native font/generated CSS and page caches. Deactivation restores the original optional resource defaults. It does not restore optional cookies already expired by the plugin.

## Verification scope

The 2026-10-15 QA run observed only first-party requests on fresh EN/DE home, location and booking pages. The original three font families loaded locally. Both location pages showed the external map card. Checkout retained Stripe requests. No GA, Sourcebuster, Reach or Automattic tracking requests appeared after activation. No JavaScript errors occurred in those six page loads.

`WP_SESSION_COOKIE` remained, with an observed lifetime of about 30 minutes. Booking and checkout retained WooCommerce's cart/nonce storage. Checkout loaded Stripe's `__stripe_mid`, `__stripe_sid` and `m` cookies. These are observed payment/session behavior, not a promise that every payment method uses identical storage. Language selection used the URL, with no language cookie observed on the sampled EN/DE pages.

Woo Blocks' `storeApiCartData` can contain entered billing/shipping contact and address fields. A paid Woo order-received page with the correct order key clears that key plus `storeApiCartHash` and `storeApiNonce`. The MotoPress reservation-received page does the same only when its payment ID/key match a completed Woo-bridge payment and the associated paid Woo order links back to that payment. The cleanup also runs after late Woo data updates and on leaving the receipt. It preserves active checkout, failed/unpaid payments, Stripe state and unrelated browser storage. Abandoned-checkout local storage can remain until browser data is cleared. No unverified inactivity expiry is promised.

The plugin expires old GA/Sourcebuster cookies when an uncached WordPress response receives them. It deliberately preserves authentication, language, booking/cart and payment cookies. Existing browser state and external provider retention require their own handling. A cache-served response might not execute cookie cleanup.

Run the isolated contracts with `php tests/wordpress-privacy.php` and `node --test tests/wordpress-privacy-browser.test.cjs` from the repository root. They check optional tracking controls, preserved transactional scripts, AJAX/server automation coverage, map/policy languages, published-page routing, paid-receipt cache cleanup and every bundled font checksum/license. Browser measurements remain necessary after vendor or theme updates because new scripts can use new handles or hooks.
