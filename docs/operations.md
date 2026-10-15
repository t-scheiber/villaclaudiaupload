# Villa Claudia operations manual

This manual covers `villa-claudia.eu`, its WordPress booking system, and the Next.js guest document application at `documents.villa-claudia.eu`. WordPress owns availability, reservations, prices, and payments. Next.js receives guest documents and sends document reminders through WordPress. A successful upload is separate from a paid booking and from official guest registration.

## Accounts and credentials

Retrieve current credentials from the owner's approved password manager. Search by the exact service hostname and account email. Do not copy passwords, API keys, private upload links, or guest identity data into this repository, screenshots, support messages, or this manual. Keep credential inventories and historical access records private. A successful existing browser session proves access, but does not independently verify a saved password.

| Service | Entry point | Account or responsibility |
| --- | --- | --- |
| Hostinger | https://hpanel.hostinger.com | Hosting, mailboxes, DNS, backups, Node deployment |
| WordPress | https://villa-claudia.eu/wp-admin/ | Authorized administrator account; bookings and site administration |
| Stripe | https://dashboard.stripe.com | `booking@villa-claudia.eu`; use the Villa Claudia account |
| Guest document app | https://documents.villa-claudia.eu | Private booking link; no public guest password |
| Source repository | https://github.com/t-scheiber/villaclaudiaupload | Next.js app and custom WordPress plugins |

Keep payment production credentials in production only. A sandbox needs its own test credentials and webhook signing secret. An email password is not a Stripe password, even when the account email is the same.

## Mailboxes

Hostinger listed the following four active mailboxes on 15 October 2026. The list matches the four addresses in the older document. No forwarding rules were listed during the check. Mailbox roles below explain their names and are not a claim that every application sender setting has been checked.

| Address | Intended use | Verified on 15 October 2026 |
| --- | --- | --- |
| `administration@villa-claudia.eu` | Administration | Active; SMTP and IMAP authentication passed |
| `booking@villa-claudia.eu` | Booking correspondence and Stripe sign-in email | Active; SMTP and IMAP authentication passed |
| `info@villa-claudia.eu` | Public enquiries | Active; SMTP and IMAP authentication passed |
| `no-reply@villa-claudia.eu` | Automated messages | Active; SMTP and IMAP authentication passed |

SMTP checks used port 465 with certificate validation; IMAP checks used port 993 with certificate validation and TLS 1.3. No messages were read or sent. They prove authentication at that time. They do not prove incoming delivery, inbox receipt, forwarding, spam placement, or that each site's configured sender is correct. Check aliases and catch-all rules separately before removing or renaming an address. After a mailbox change, update WordPress administration, MotoPress customer/administrator notifications, WooCommerce notifications, Stripe account contact details, and the Next.js `EMAIL_*` / `ADMIN_EMAIL` settings where applicable. Send a clearly identified test only to an owned test inbox and verify receipt.

The production WordPress mail transport authenticated successfully over verified TLS. Confirm the application's configured sender, reply address and approved document recipient in the private operations record before changing them. An advertised application sender may differ from the effective transport sender. Document forwarding is not proof of statutory registration.

## Hosting and deployment

The Hostinger account contains a WordPress site and a Node.js site under the same domain family. Their conventional paths are `/home/<HOSTING_USER>/domains/villa-claudia.eu/public_html` and `/home/<HOSTING_USER>/domains/documents.villa-claudia.eu/public_html`. Obtain the actual hosting username from the private account record.

Hosting, email and domain renewal details are held in the private operations record. Confirm current renewal dates, automatic-renewal settings and billing responsibility in the provider account before relying on continued service.

The Node app builds the repository's `main` branch using Node.js 22 and npm. Its build command is `npm run build`, using Next.js's Webpack backend. The latest completed deployment observed at the start of this inspection was commit `0f150cf1d920cd25115df3523cbdb331b25665d2`, dated 11 October 2026. Verify the deployment revision after every release. Updating Git does not install any WordPress plugin.

Configure the server variables listed in [README.md](../README.md). Match `WORDPRESS_API_KEY` with the Villa Claudia Docs setting and `CRON_SECRET` with the protected cron configuration. Use port 465 for implicit TLS or 587 for STARTTLS. Keep TLS certificate verification enabled. Do not publish a diagnostic endpoint or log environment values to troubleshoot credentials.

## Bookings and rates

Use the WordPress booking administration to inspect the MotoPress reservation, dates, guest email, status, and linked WooCommerce order. Availability depends on both reservations and calendar synchronization. Before changing a booking, check the linked order and payment record so that a refund or cancellation is not mistaken for a simple date edit.

MotoPress seasons define date ranges. Rates determine prices for those seasons and accommodation types. After a price edit, test representative dates in each relevant season and year on the public booking page, then check the total at checkout. The custom rates display deliberately does not borrow another year's rates when the selected year has no prices.

WordPress uses Europe/Zagreb. Check-in was documented in the current application as 15:00. Confirm all customer-facing arrival, departure, minimum-stay, occupancy, tax, fee, cancellation, and deposit wording against the saved booking settings when making a commercial change.

The custom plugin registers a five-minute MotoPress synchronization interval. Confirm that the saved interval and scheduled `mphb_cron_ical_auto_synchronization` event agree. A scheduled event is not proof that each external calendar import succeeded. Review synchronization logs, source calendar URLs, and representative blocked dates. Keep live calendar imports and exports disconnected from test copies.

## WordPress content and translations

Open the relevant page in the WordPress Pages list and use its existing Divi layout. Preview edits before publishing, then check the published page in both languages and at a narrow mobile width. Keep the original booking forms, rate shortcodes, and links intact unless their replacement is part of the change. Upload appropriately sized images to the media library and supply useful alternative text for informative images.

Use TranslatePress's translation editor on the published page for the other language. Check navigation, buttons, booking labels, dates, and dynamic validation messages in addition to body text. Translation settings and database optimization are separate from editing a translated phrase. Purge the relevant cache after publishing and verify the public result.

The rates plugin registers `[villa_claudia_rates]`; the restaurant plugin registers `[restaurant_zigzag]`. Their code lives in `rates-display-plugin/` and `restaurant-posts-zigzag/`. Do not replace generated rate output with fixed text that can diverge from MotoPress prices. Restaurant cards use normal links and must remain usable on mobile and when reduced motion is enabled. Compare each destination with the intended restaurant before changing it.

## Guest document workflow

For a confirmed booking, open its document panel and copy the current private upload link. The path is `/uploads/vc_` followed by 64 hexadecimal characters. Older numeric links or `?booking=...` links are not supported. Links expire after checkout and change when the booking dates or guest email change. Send a replacement link from the current booking record rather than editing an old link.

The form accepts JPEG, PNG, and PDF files, with 1 to 8 files, no more than 10 MiB per file, and no more than 25 MiB combined. Guests enter the required document details. The form offers passports and national ID cards for EU, EEA, and Swiss citizenships. A driving licence is not an offered travel document. The operator must review legibility, completeness, guest identity, and the applicable registration requirements.

WordPress checks the token, booking association, and file contents before storing documents under `wp-content/uploads/booking-documents/<booking ID>/`. Direct web access must be denied. Administrative downloads and deletion require WordPress permissions and nonces. A failed batch is rolled back. New documents remain pending until an operator verifies them.

If the form says the documents were saved but notification failed, do not ask the guest to upload again. Inspect the booking document panel and investigate email separately. If the browser loses the upload response, reconcile the stored files before retrying. A second submission could duplicate a successfully stored batch.

To forward verified documents, first confirm that every attachment is readable and that the configured recipient is the correct authorized recipient for this property. Send once through the administration interface and review the result. Mail acceptance does not establish official tourist registration. Keep the authority's registration receipt or other required confirmation separately. Never send real identity documents as a sandbox test.

## Reminders and recovery

Hostinger's cron panel confirmed the daily `0 12 * * *` job running `/usr/bin/php /home/<HOSTING_USER>/domains/villa-claudia.eu/public_html/cron-document-reminders.php`. The scheduler's timezone remains unverified. The panel's saved output showed processed 0, sent 0 and failed 0, without a visible run timestamp. This is evidence of a saved successful empty run, not a dated current delivery receipt. SSH did not provide the `crontab` command; that did not establish an empty schedule. The script calls the Next.js reminder endpoint with a Bearer secret. It reads the secret from its environment or a protected `.env.cron` next to the script; logs belong outside `public_html`. HTTP access to the script must remain blocked.

Confirmed bookings without stored documents become eligible seven days before arrival through arrival day, using Europe/Zagreb calendar dates. Imported bookings without an email address are skipped. WordPress claims each reminder atomically so overlapping runs do not normally send twice. Claims depend on dates and email, so a corrected booking may need a replacement link.

A definite SMTP rejection releases the claim. An ambiguous connection loss or a failure to record acceptance retains it and produces a failed result. Compare the mail provider's evidence with the booking and claim before retrying. Do not clear all claims. After proving no delivery, delete only the exact `vc_reminder_<booking ID>_<fingerprint prefix>` option. If mail was accepted, complete the original claim through the authenticated completion endpoint. Never treat a successful cron HTTP response as proof of inbox receipt.

## Safe updates and rollback

1. Record current versions, deployed commit, payment mode, webhook endpoints, cron jobs, and the issue being addressed. Check for unrelated local edits before changing source.
2. Create and confirm a recoverable backup of WordPress files and database. Protect the Node environment and private cron configuration outside the web root. Record the backup date and restore method.
3. Prepare an isolated test copy. Disable mail delivery to guests, reminder jobs, calendar imports/exports, authority forwarding, and live payment credentials before using it.
4. Apply compatible updates to the test copy. Update custom plugin files together. Run the automated checks and the functional matrix below, including the public pages and checkout.
5. Release the tested revision and WordPress updates, purge relevant caches, and repeat the production smoke checks. Verify the active revision and versions directly.
6. If the release breaks booking, payment, uploads, or administration, preserve error evidence and restore the matching files and database backup. Do not restore an old database over new guest bookings without reconciling those bookings first.

TranslatePress database optimization is a separate database operation. Back up first, complete the operation in a suitable maintenance window, and check both languages afterward. Renovate, configured in `renovate.json`, proposes repository dependency updates. The validation workflow runs JavaScript checks and isolated PHP tests. Review the test results before accepting an update.

## Functional verification matrix

Record date, environment, revision, expected result, actual result, and test record IDs for each check. Use synthetic guests and files. Keep keys, private links, and identity data out of the evidence.

| Area | Checks required before calling the flow complete |
| --- | --- |
| Public WordPress pages | Main navigation, both languages, mobile layout, images, rates by year, restaurants, location and contact links |
| Availability | Valid dates, occupied dates, minimum stay, occupancy limits, calendar imports, no duplicate reservation |
| Booking and payment | Sandbox card success, decline, 3-D Secure, cancelled checkout, duplicate submission, order/reservation status, webhook delivery and retry |
| Payment reversal | Sandbox refund/cancellation and the resulting order, booking, availability, and email states |
| Guest documents | Valid link, expired/revoked/numeric link rejection, all offered document types, file count/size/type limits, missing required fields, upload success and partial mail failure |
| Administration | Pending review, authenticated download, verification, single-document deletion, synthetic forwarding, failures and cleanup |
| Reminders | Eligibility dates, missing email skip, repeat/overlap protection, definite failure retry, ambiguous delivery reconciliation |
| Email | Correct configured sender/recipient, test receipt in owned inbox, reply path, incoming delivery and spam placement |
| Operations | Backups/restoration method, private file denial, cron authentication, error visibility, deployment revision |

Stripe test keys and sandbox data are separate from live payments. The sandbox checkout must use test mode on the isolated copy, a matching test webhook signing secret, and Stripe's documented test payment details. Check the Stripe event, WooCommerce order, MotoPress reservation, and inbox receipt for the same booking. Stripe's [testing guide](https://docs.stripe.com/testing) describes supported test methods. A webhook status alone is insufficient evidence of a completed booking.

## Verification record for 15 October 2026

The expanded suite passed all 38 Node.js workflow tests and 108 PHP assertions, including 26 staging-isolation assertions, using PHP 8.3.35, matching production. Lint and production builds passed with Node.js 22 and 24. Measured coverage for the loaded server/library modules was 100% of lines and functions and 97.57% of branches. This is a scoped coverage result, not a claim of complete browser, WordPress, or payment coverage. `npm audit --omit=dev` reported zero known vulnerabilities for the production dependency tree at the initial check.

The [document integration verification](integration-verification-2026-10-15.md) records 40 passed checks against the isolated staging WordPress copy and a local production Next.js build: 16 HTTP/upload checks, 12 storage/reminder checks and 12 hydrated browser checks. Additional SMTP rejection, forwarding and single-document deletion checks passed. Messages used private capture rather than real inbox delivery, and files were synthetic. The integration report records the concurrent pending-claim 502 response and the later successful replay explicitly. These checks do not prove Stripe card checkout.

Live observations included WordPress 7.1.3, PHP 8.3.35, Divi 4.27.9, 23 installed plugins with 21 active and 2 inactive, TranslatePress 3.3.8, MotoPress Hotel Booking 6.4.0, WooCommerce 11.2.1, and Stripe Gateway 11.1.0. No WordPress updates remained pending at the version check, and core checksums passed. Docs 1.7.6, rates display 1.9.5 and restaurant plugin 1.4.6 were subsequently deployed with private rollback backups and matching source hashes. Authorized administrative access was confirmed. The owner confirmed `booking@villa-claudia.eu` as the current Stripe account email.

Read-only public checks returned HTTP 200 for all 101 tested first-party URLs and all 122 collected first-party assets. Availability searches returned the expected seven-night results for October 2026 and June 2027 and no result for the tested one-night or insufficient-notice stays. See the [public audit](public-audit-2026-10-15.md) for exact scope and content issues. Follow-up updates corrected arrival directions in both languages to the owner's confirmed `Valentići 32` address, removed the unverified fixed border hours, and translated the German booking policy, booking terms, and all 22 displayed restaurant descriptions. The English business terms were preserved. Rates display 1.9.5 now shows 2026 and 2027 from MotoPress's actual recurring periods. Remaining content checks include a restaurant location contradiction, rates-label translations, heading structure, and document privacy information. These response checks do not establish visual or checkout behavior.

Three German translations incorrectly stored in the English WooCommerce dictionary were restored to English for First name, Last name and Phone, both on production and staging, after private backups. The German dictionary was unchanged. A separate checkout test found that the legacy Divi checkout submitted different hidden billing values from the visible fields. The native WooCommerce checkout fix was structurally verified on staging and deployed to production after a private backup.

The WordPress privacy setting produces an empty checkout privacy URL. No published substitute was found. An English and German privacy draft is held locally for owner review and has not been published or enabled. Controller identity, legal duties, retention, recipients, provider agreements and actual cookies require confirmation before release.

The public `/error_log` path initially returned HTTP 200 and was blocked during the inspection. The follow-up request returned HTTP 403 while the homepage remained HTTP 200. Sensitive environment/configuration files were restricted to mode `0600`. WordPress core and 15 plugins passed published checksum verification; eight plugins had no published checksums available. No checksum mismatch was reported.

Hostinger staging was created at `qa20261015.villa-claudia.eu`. It is marked as staging, its cron is disabled, mail is captured privately, and outgoing requests are guarded to the staging site and Stripe for test preparation. Confirm those protections again before adding tests or extensions that can send data externally.

WooCommerce displayed a warning about its saved Stripe test webhook. The test webhook configuration was repaired for production and staging using test credentials. API verification confirmed enabled test endpoints with `livemode=false`, and production test mode remained disabled before and after. An isolated booking completed a EUR 3,010 test payment after a card-decline case, a failed 3-D Secure case and successful 3-D Secure authentication. Stripe verified `livemode=false`, the booking was confirmed and the order paid. The successful event had zero pending webhook deliveries; the staging handler recorded success and no outstanding failure.

The same paid synthetic booking then passed the document reminder/upload flow through Next.js and WordPress, with guest and administrator messages captured privately. A native WooCommerce refund returned the full EUR 3,010, the order became refunded and the booking was cancelled. Stripe's API confirmed the refund succeeded. The cancelled booking's token returned 404 and the dates became available again. Synthetic records and files were cleaned up; the refunded order remains recoverable in trash with its refund attached. All payment and refund activity used test mode. These results do not establish actual external inbox delivery, statutory registration, live money movement or every supported payment method.

Hostinger completed production build `01a1408b-3944-704b-846c-6be14639a927` at `2026-10-15T17:11:42Z` from main commit `1087f3d47f4c36dd1aa0890cc67ee3ae75af5021`, using Node.js 22 and npm. That receipt predates the dependency refresh below and does not prove deployment of its newer package versions.

## Compatible dependency refresh

The follow-up refresh updates the compatible runtime and lint packages available on 15 October 2026.

| Package | Previous installed version | Refreshed version |
| --- | --- | --- |
| Next.js | 16.3.8 | 16.4.1 |
| Nodemailer | 10.1.0 | 10.1.1 |
| React and React DOM | 19.3.0 | 19.3.1 |
| Radix React Slot | 1.4.0 | 1.5.0 |
| Lucide React | 1.55.0 | 1.57.0 |
| Next.js ESLint plugin | 16.4.0 | 16.4.1 |
| TypeScript ESLint packages | 8.71.1 | 8.71.2 |

ESLint remains on the supported 10.12.0 release. The old `eslint-config-next/typescript` wrapper was replaced by its equivalent direct TypeScript ESLint configuration. Its unused transitive lint plugins required older ESLint peers. The enabled lint rules remain unchanged, including the Next.js rules and the two existing warning overrides. A clean install and the complete dependency-tree check passed without peer conflicts. The obsolete `@types/uuid` stub was removed because UUID includes its own declarations.

`npm outdated` now lists only the held major upgrades to TypeScript 7.0.2 and Node type definitions 26.6.5. The project retains TypeScript 6.0.3 and Node type definitions 25.9.9. The current TypeScript ESLint release supports TypeScript below 6.1, so TypeScript 7 requires a coordinated tooling migration. These holds are explicit compatibility decisions, not completed updates.

After the refresh, all 38 Node.js tests, lint and the production build passed on Node.js 22.23.3. `npm audit --omit=dev` reported zero known vulnerabilities in the production dependency tree. The full audit reported four high-severity development-tool findings through the chain `@next/eslint-plugin-next -> fast-glob -> micromatch -> braces`. The [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version; the registry still publishes 3.0.3 as latest. The audit's suggested Next.js lint-plugin downgrade to 14.2.35 was not applied. Recheck this advisory when an upstream fix is released. Do not describe the full development tree as vulnerability-free.

The refreshed Next.js 16.4.1 build has passed local validation. A new Hostinger build and production smoke verification are still required before recording it as deployed.

## Changes from the old Word document

The updated manual keeps credentials in private access records, records the current public contact details, retains the four verified mailboxes, replaces numeric upload links with token links, corrects accepted document types, distinguishes rates from seasons, and identifies Renovate as the repository dependency updater. It separates mail acceptance from inbox delivery and from official registration. Version numbers and account expiry dates are dated observations so they can be checked again instead of silently becoming permanent instructions.
