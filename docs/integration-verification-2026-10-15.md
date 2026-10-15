# Document workflow integration verification

These checks used the isolated `qa20261015.villa-claudia.eu` WordPress copy and a local production build of the Next.js app. Every guest address ended in `@fake.test`. Files contained synthetic text or a one-pixel image. No identity document, real guest notification, registration submission, or live payment was used.

## Isolation checked before testing

- WordPress reported the `staging` environment and `DISABLE_WP_CRON=true`.
- The staging must-use plugin intercepted WordPress mail and blocked external requests apart from the staging site and Stripe test requests.
- WooCommerce exposed test mode and cleared its live Stripe keys on the staging copy.
- The upcoming-booking endpoint initially returned zero bookings. Before reminder execution, every returned recipient was synthetic.
- The local Next.js app used a TLS SMTP sink bound to `127.0.0.1:465`. Its temporary certificate was explicitly trusted through `NODE_EXTRA_CA_CERTS`. Certificate verification stayed enabled. The sink never relayed mail.

## Actual integration results

The principal run passed 40 checks.

| Checks | Verified behavior |
| --- | --- |
| 16 HTTP/upload checks | Next.js resolved the canonical staging booking through authenticated WordPress; cancelled, expired and changed links returned 404; private responses disabled caching and referrers; blank metadata, unsupported types, spoofed PDF content and excessive file counts failed; both synthetic PDF pages persisted; the captured notification preserved separate attachments and canonical booking identity. |
| 12 storage/reminder checks | WordPress metadata recorded pending documents; files existed with separate random names; direct document URLs returned 403; unauthenticated cron failed; two concurrent reminder requests produced exactly one captured message; replay sent zero messages; WordPress persisted completed reminder state. |
| 12 hydrated browser checks | The real form had no horizontal overflow at 320, 390 and 1280 pixels; required fields blocked submission; error feedback received focus; changing nationality reset an unavailable ID choice; removing an earlier guest preserved the remaining file and details; the form capped uploads at eight guests; a double-click produced one upload request; success received focus; no JavaScript exceptions occurred. |

The concurrent reminder requests returned 200 and 502. The second worker encountered the first worker's pending atomic claim and sent no mail. A subsequent run returned 200 with zero sent and zero failed. The 502 in this test was the existing pending-claim behavior, not evidence of duplicate delivery.

Additional failure and administration checks passed:

- A real SMTP `535` authentication rejection occurred after WordPress stored a synthetic document. Next.js returned 201 with `wordpressStorage=true` and `notificationSent=false`. Its message told the guest that another upload was unnecessary. The sink accepted no additional email.
- All synthetic stored files had mode `0600` on the Linux host.
- Forwarding one verified synthetic document reached the staging mail interceptor, recorded the accepted handoff, and removed temporary copies. This verifies the application workflow only. It is not a registration-authority delivery receipt.
- Deleting the selected synthetic image removed its file and metadata while preserving the remaining documents.

The initial document fixtures had no room reservations. After the separate paid-booking test, its captured reminder generated an opaque link, and the local Next.js app uploaded a synthetic PDF for that same paid booking. WordPress persisted both its document and completed-reminder flags.

After the test refund, the booking became cancelled, its upload token returned 404, and MotoPress reported the villa available again for the tested dates. Synthetic bookings, reserved-room and payment records, the hidden QA product and the WooCommerce order entered recoverable trash. Four remaining synthetic document files and their metadata were removed. The refund record remains attached to the trashed order because the WooCommerce refund data store does not support trash. The local Next.js and TLS capture services were stopped.

## Repeatable regression checks

Run the Node suite and targeted coverage from the repository root:

```text
npm test
node --experimental-test-coverage --test --test-coverage-include="lib/**" --test-coverage-include="app/api/**" tests/workflow.test.cjs
npm run lint
npm run build
```

The 38 Node tests passed on Node 22.23.3 and 24.21.0. The targeted V8 report measured 100% lines, 100% functions and 97.57% branches for the loaded server/library modules. The isolated loader transpiles TypeScript and replaces external mail/WordPress calls. These percentages do not measure browser components, WordPress core, vendor plugins, Stripe, or the whole deployed system.

Run the PHP workflow checks with PHP 8.3 and the fileinfo extension available:

```text
php tests/wordpress-workflow.php villa-claudia-docs/workflow.php
php tests/wordpress-calendar.php villa-claudia-docs/villa-claudia-docs.php
php tests/wordpress-forwarding.php villa-claudia-docs/workflow.php
php tests/wordpress-upload.php
php tests/wordpress-rates.php rates-display-plugin/villa-claudia-rates-display.php
php tests/staging-guard.php
```

The PHP suites passed 108 assertions. The multipart harness starts its own loopback PHP server and removes its temporary synthetic files. Its 20 assertions exercise real PHP upload handling, MIME inspection, limits, protected storage, rollback and HTML-only metadata that becomes empty after sanitization. It does not load a customer database or send email. CI includes these checks and the separate staging-isolation checks.

The checkout structure check uses a disposable cookie session and the hidden staging product. It does not create an order or submit a payment:

```text
python scripts/verify-staging-checkout.py --url https://qa20261015.villa-claudia.eu --product-id <SYNTHETIC_PRODUCT_ID>
```

Replace the product placeholder with a fresh hidden synthetic product on the staging copy. The original inspection product is now in trash.

Repeat the full integration run only on an isolated copy with mail capture, fresh synthetic fixtures and cron disabled. Configure the local app with the staging WordPress endpoint and service key, a synthetic SMTP identity, the trusted local capture certificate and a separate cron secret. Do not copy production SMTP settings into this test environment. Validate the upstream recipient list before triggering reminder processing. Private fixture tokens, keys, captured MIME files and temporary scripts stay outside the repository.

## Checkout defect found during the separate payment test

The legacy checkout page used separate Divi billing, shipping and payment modules. The visible billing fields and the submitted payment form contained different address values. The latter had empty hidden copies, so WooCommerce rejected a visibly completed address.

The staging checkout page was changed to the native `[woocommerce_checkout]` shortcode with the Divi page builder disabled for that page. A fresh synthetic cart then rendered one checkout form, one billing-address field and payment fields in the same form. The browser payment test then passed address validation, displayed a Stripe test-card decline, and completed a successful 3-D Secure test payment. WooCommerce recorded the order as paid and MotoPress confirmed the booking. The test payment was refunded afterwards.

The same native checkout fix was deployed to production after a private backup of the page and its metadata. The surrounding theme remains active. Only the checkout page was changed. No staging database was published.

## Custom plugin deployment

Docs 1.7.6 and Restaurant Posts Zigzag 1.4.6 were deployed to production after source review, PHP syntax checks and private backups. All three deployed PHP files matched local SHA-256 hashes. WordPress reported the expected versions and the public homepage returned 200. Installable ZIP entries were rebuilt and verified byte-for-byte against their source files.

Private rollback locations and checksums are recorded in the local operating documentation. No staging database was published. Next.js deployment and the separate rates update are outside this deployment receipt.
