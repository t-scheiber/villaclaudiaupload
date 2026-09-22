# Villa Claudia document uploads

Next.js guest document form with a WordPress/MotoPress storage and booking API. Production runs Node.js 22 and npm on Hostinger. The installed WordPress plugin is in `villa-claudia-docs/`.

## Configuration

Set these server variables in Hostinger. Never commit values or include them in logs:

- `NEXT_PUBLIC_BASE_URL=https://documents.villa-claudia.eu`
- `WORDPRESS_API_URL=https://villa-claudia.eu/wp-json/villa-claudia/v1`
- `WORDPRESS_API_KEY`: match the WordPress plugin setting.
- `CRON_SECRET`: match the private cron environment file.
- `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `ADMIN_EMAIL`.
- `EMAIL_PORT`: 465 for implicit TLS or 587 for STARTTLS. Certificate validation is required.

Install with `npm ci`; run `npm test`, `npm run lint`, and `npm run build`. Run PHP checks with `php tests/wordpress-workflow.php villa-claudia-docs/workflow.php`. The PHP test does not load a production database.

Hostinger builds `main` with npm and deploys `.next`. Deploy both plugin PHP files together and the CLI cron script separately. Changing the Git repository does not install the WordPress plugin. Back up files, database, and server environment outside the web root before deployment.

## Guest access and storage

Guest links use a random `vc_` token with 256 bits of randomness. The WordPress booking document panel shows a current link for confirmed bookings. Numeric/date-based links are rejected, including previously saved links. Issue replacement links from the booking panel or reminder workflow. Links expire after checkout and are revoked when dates or guest email change. Treat these bearer links as private.

The same token resolver protects the page, booking API, and upload API. Browser-supplied guest names and email do not determine the notification recipient or booking association. WordPress validates the token again and derives the booking ID itself.

Uploads allow 1-8 JPEG, PNG, or PDF files, at most 10 MiB each and 25 MiB total. WordPress verifies file contents using MIME detection, chooses random names, and rolls back a batch if storage fails. Files remain under `wp-content/uploads/booking-documents/<booking ID>/`; direct web access must be denied. Admin download/delete routes require WordPress capabilities and nonces. New documents await review.

The application reports success only after WordPress confirms every file was saved. If the admin email fails after storage, the guest sees that documents are saved and is told not to upload them again. SMTP acceptance is not proof of inbox delivery.

## Reminders

The existing daily Hostinger job runs `cron-document-reminders.php` through PHP CLI. It calls `GET /api/cron/document-reminders` with a Bearer secret. POST is also supported. Missing configuration fails closed; backend and mail errors produce a failing cron result. The script reads `CRON_SECRET` from its environment or the protected `.env.cron` beside it. Logs go to `../private-logs/`, outside public_html. HTTP access to the script is denied.

Confirmed bookings with an email address and no stored documents are eligible from seven days before arrival through arrival day, using Europe/Zagreb calendar dates. Imported bookings without an email are skipped. Atomic WordPress claims prevent overlapping runs from sending the same reminder. Delivery state is tied to booking dates and email; corrected bookings can receive a replacement link. Recipient and token come from the same claim snapshot.

Definitive SMTP failures release the claim for retry. Ambiguous disconnects or failure to record SMTP acceptance preserve the claim and cause a visible failed result. Reconcile these against SMTP logs before resending. Claims are private WordPress options named `vc_reminder_<booking ID>_<first 32 characters of booking fingerprint>`. After confirming no delivery, delete only that exact claim option to permit retry. If delivery was accepted, use the authenticated reminder completion endpoint with the original claim ID and `delivered: true`. Never clear all claims automatically.

## Production operations

Disable LiteSpeed REST caching and purge cached private responses. Private API routes also emit no-store headers. Keep backup PHP files, environment files, logs, and document files inaccessible through HTTP. Preserve the configured document-forwarding recipient; sending from the admin UI is an explicit operator action and does not establish authority registration.

The plugin registers `vc_five_minutes` and adds it to MotoPress's calendar interval selector. Production uses this interval to preserve its existing five-minute synchronization cadence while keeping the saved setting and scheduled event consistent. Select another supported interval in MotoPress if changing the cadence. Admin document deletion removes only the selected metadata record, preserving concurrent uploads; storage failures are reported.

Booking/payment settings are in WordPress, not this Next.js app. Check-in is 15:00, timezone Europe/Zagreb, and WooCommerce uses the published basket page. Stripe production mode remains enabled. A healthy webhook and account configuration do not prove a completed card payment, 3-D Secure challenge, refund, or guest inbox delivery. Verify those separately in an isolated test environment before claiming complete payment end-to-end coverage.
