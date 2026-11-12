# Villa Claudia guest registration

Next.js app for the guests of the Villa Claudia holiday rental. A guest opens a private link from a reminder email and sees arrival guidance. The app can also take one temporary copy of an identity document, but only for a documented exception. Normal registration uses inspection of the original identity document at arrival, and advance copies are not routinely required. WordPress with MotoPress holds the bookings, rates and payments. This repository also contains the WordPress plugins written for that site.

The [operations manual](docs/operations.md) covers booking, payments, mailbox verification, deployment, privacy publication, cleanup and recovery. The [earlier integration report](docs/integration-verification-2026-10-15.md) records the initial document-workflow audit and its limits. The manual names Node.js 22 and npm on Hostinger for production, and CI uses Node.js 22 too.

## Stack and layout

The app uses Next.js 16.4.6 (App Router), React 19.3.1, TypeScript 6.0.3 and Tailwind CSS 4.3.5. Mail goes out through Nodemailer 10.5.0. Tests use the Node.js built-in test runner and linting uses ESLint 10.14 with typescript-eslint.

- `app/` has the pages `/`, `/uploads`, `/uploads/<token>`, `/privacy` and `/privacy/de`, and four API routes: `api/booking`, `api/upload`, `api/copy-exception/withdraw` and `api/cron/document-reminders`.
- `lib/` has the WordPress client, the reminder scheduler and the mail setup.
- `villa-claudia-docs/`, `rates-display-plugin/`, `restaurant-posts-zigzag/` and `villa-claudia-privacy/` are the WordPress plugins, in PHP.
- `cron-document-reminders.php` and `cron-privacy-retention.php` are command-line jobs for the WordPress host.
- `tests/` has the Node tests (`*.test.cjs`), the PHP checks and two Python browser and publication checks.
- `restaurant-posts-zigzag.zip`, `villa-claudia-docs.zip` and `villa-claudia-rates-display.zip` are installable packages of three of the plugins. At this commit their PHP contents match the source folders apart from line endings.

## Run locally

```sh
npm ci
npm run dev
```

`npm run dev` starts Next.js with Turbopack. The home page, `/uploads` and the privacy pages render without a backend. A private booking page and the API routes call WordPress, so they need `WORDPRESS_API_URL` and `WORDPRESS_API_KEY`. Use a test WordPress site with the Docs plugin, not the production site.

## Configuration and checks

Set these server variables in Hostinger. Never commit their values or log them:

- `NEXT_PUBLIC_BASE_URL=https://documents.villa-claudia.eu`. Reminder mail refuses to send unless it is an https URL. Page metadata falls back to this value when it is unset.
- `WORDPRESS_API_URL=https://villa-claudia.eu/wp-json/villa-claudia/v1`
- `WORDPRESS_API_KEY`, matching the WordPress plugin setting. Without the URL or the key, the API routes answer 503.
- `CRON_SECRET`, matching the protected reminder-job configuration. Without it the reminder endpoint answers 503.
- `EMAIL_HOST`, `EMAIL_USER` and `EMAIL_PASSWORD`. Without them no mail is sent.
- `EMAIL_PORT`, 465 for implicit TLS or 587 for STARTTLS, default 587. Other ports are rejected, and the code always validates the server certificate.
- `EMAIL_FROM` and `ADMIN_EMAIL` are optional. Both fall back to `administration@villa-claudia.eu` in the code.

The scripts are `npm run dev`, `npm run build`, `npm start`, `npm test` (`node --test tests/*.test.cjs`) and `npm run lint`. Install with `npm ci`, then run `npm test`, `npm run lint` and `npm run build`. GitHub Actions runs these on every pull request and push to `main` with Node.js 22, followed by the PHP checks below. The PHP checks need PHP 8.3:

```sh
php tests/wordpress-workflow.php villa-claudia-docs/workflow.php
php tests/wordpress-calendar.php villa-claudia-docs/villa-claudia-docs.php
php tests/wordpress-forwarding.php villa-claudia-docs/workflow.php
php tests/wordpress-rates.php rates-display-plugin/villa-claudia-rates-display.php
php tests/wordpress-upload.php
php tests/wordpress-copy-privacy.php villa-claudia-docs/workflow.php
php tests/wordpress-privacy.php
php tests/staging-guard.php
```

These checks use isolated fixtures, not the production database or real email delivery. Forwarding tests verify that identity-copy forwarding is blocked. A Node test in `tests/privacy.test.cjs` requires the reviewed canonical notice to have `status: published`.

`npm run build` runs `next build --webpack`, and the operations manual says Hostinger builds `main` that way with Node.js 22 and npm. Local development uses Turbopack. Git deployment does not install the WordPress plugins or CLI scripts.

## Arrival guidance and documented exceptions

Private links contain a random 256-bit `vc_` token. Numeric/date-based links are rejected. The current booking panel supplies the link; it expires after checkout and changes when dates or guest email change. Treat it as a bearer credential. Page, booking and upload APIs resolve the same booking identity server-side.

Without an active exception, the private page tells guests to bring the original identity document for inspection and registration at arrival. An authorized administrator can record an exceptional objective difficulty only after actual arrival, within the registration window, for a confirmed booking's named lead adult. The case records actual arrival in Europe/Zagreb and a specific reason. Convenience or routine remote check-in alone is not an exception.

The case expires no later than actual arrival plus 23 hours 50 minutes. It cannot be extended or reopened for the same closed booking identity. The ten-minute margin allows the five-minute cleanup job to remove the copy before the 24-hour registration deadline.

Only an active, matching case enables the optional form. It accepts the named adult's own single JPEG, PNG or PDF, up to 10 MiB. Other adults' and children's documents cannot be submitted on a booker's consent. The guest can choose original-document inspection without uploading, or withdraw and delete copies from the same private page. The form and API do not collect a document-number field. The operator still verifies that the actual file belongs to that guest and contains no unrelated documents.

WordPress validates the token, case ID, consent and file contents again. It derives the booking association and canonical name itself. Files receive normalized random names and are held in a restricted OS temporary directory outside website content directories. This is not RAM-only storage or a guarantee about every infrastructure-level provider backup. Direct file access and administrative downloads remain protected.

Registration completion, guest withdrawal and expiry close the case and remove copies. Access stops at expiry. Minimal case/consent/closure evidence can remain under the published necessity and claims criteria, without image content, document-number fields or a duplicate traveler-name field. Identity copies are not forwarded or attached to email. Notifications omit document numbers and file attachments. An upload receipt is not proof of eVisitor registration.

If storage succeeds but notification fails, reconcile the stored state before retrying. SMTP acceptance is not proof of inbox delivery.

## Privacy notice and website resources

`content/privacy-policy.json` is the canonical English/German notice. Next.js renders it at `/privacy` and `/privacy/de`. `scripts/publish-privacy.php` publishes identical static fragments to WordPress, sets the privacy-page option and updates WooCommerce's privacy text. The WordPress privacy plugin adds the public footer and booking/checkout notices.

Deploy the complete normal WordPress plugin directory `villa-claudia-privacy/` and activate it. Keep its fonts, CSS, checkout script, manifest and font licenses together. The plugin disables optional analytics, Sourcebuster attribution and Reach injection, serves the existing fonts locally and replaces automatic Google Maps loading with an external directions link. Clear Divi's generated CSS/font cache and page caches for the target environment, then verify both languages.

The notice describes necessary booking sessions, WooCommerce browser cart/checkout storage and Stripe's checkout resources. A verified paid WooCommerce or MotoPress confirmation page clears `storeApiCartData`, `storeApiCartHash` and `storeApiNonce`. Abandoned checkout storage has no invented automatic expiry; browser clearing remains available. Private guest pages do not use their own visitor cookies or browser storage for guest data.

## Scheduled jobs and restore protection

Deploy all three Docs PHP files together: `villa-claudia-docs.php`, `workflow.php` and `copy-privacy.php`. Deploy `cron-document-reminders.php` and `cron-privacy-retention.php` separately beside `wp-load.php`. Both scripts reject HTTP access.

The existing daily reminder job calls the authenticated Next.js endpoint and asks guests to bring original ID at arrival. It does not demand routine advance uploads. Missing configuration fails closed. Definite SMTP failures release a reminder claim; ambiguous delivery preserves it for reconciliation. See the operations manual before changing an individual claim.

Run `cron-privacy-retention.php` through CLI every five minutes. It deletes expired or invalid exception copies and reapplies the specifically approved legacy-erasure receipt. Set `VILLA_CLAUDIA_ERASURE_RECEIPT` in the private WordPress configuration to the verified absolute receipt path outside `public_html`, conventionally `$HOME/private/villa-erasure-receipt.json`. Keep the directory `0700` and receipt `0600`. The receipt contains approved path hashes and sizes, not guest document content. Missing/unreadable/invalid configured receipts or cleanup failures must produce a failed result and require investigation.

Before reopening a restored site, restore the protected erasure receipt/configuration, reapply cleanup and verify that closed cases and specifically erased legacy files have not returned. Do not restore deleted copies into service or treat ordinary website backups as a permanent ID archive. Never expand the approved erasure list to unknown files automatically.

## Booking and release evidence

WordPress owns availability, rates and Stripe payments. MotoPress seasons define dates; rates define prices. The rates plugin preserves the requested year and uses actual recurrence periods. Restaurants use ordinary links and remain usable on mobile and with reduced motion.

The [15 October verification record](docs/operations.md#verification-record-for-15-october-2026) includes an isolated EUR 3,010 booking with card decline, failed and successful 3-D Secure, paid order and confirmed reservation, followed by a full test refund, cancellation and released dates. All funds were Stripe test mode and mail was captured privately. These checks do not establish live money movement, external inbox delivery, statutory registration or every payment method.

The [privacy verification report](docs/privacy-verification-2026-10-15.md) provides reproducible scope and commands. The [privacy-release record](docs/operations.md#privacy-release-verification) separates the newer exception, cleanup, policy-parity and tracker checks from that earlier audit. Verify the active Git revision and all WordPress file hashes after each release.
