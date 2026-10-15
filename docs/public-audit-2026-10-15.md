# Public website audit, 15 October 2026

Read-only checks ran against `https://villa-claudia.eu` and `https://documents.villa-claudia.eu`. They did not create a reservation, upload identity documents, send email or make a payment. This report covers HTTP responses, rendered server HTML, published content and availability searches. Browser interaction and visual checks require separate evidence.

## Verified checks

| Check | Result |
| --- | --- |
| Main WordPress pages | Home, booking, location, gallery, amenities, rates and restaurants returned HTTP 200. |
| German pages | Home, booking, location, gallery, amenities, rates, restaurants and booking terms returned HTTP 200. |
| Internal links and sitemap pages | All 101 distinct first-party URLs checked returned HTTP 200 after redirects. This set includes linked full-size photographs. |
| First-party page assets | All 122 distinct image, script and stylesheet URLs collected from the initial page set returned HTTP 200. This does not cover every responsive image variant or CSS background image. |
| Empty checkout | `/checkout/` redirected to `/basket/`, which returned HTTP 200. No cart or order was created. |
| Discovery files | WordPress `robots.txt` and sitemap index returned HTTP 200. |
| Document app entry pages | `/` and `/uploads` returned HTTP 200 with instructions to use the personal email link. |
| Invalid document links | Both a malformed token and a syntactically valid synthetic token showed the controlled invalid or expired link message and a support contact. Neither response contained guest details. |
| Invalid booking API request | `/api/booking?id=invalid` returned HTTP 404 with a controlled error. |
| Document link privacy headers | Dynamic upload pages returned `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex, nofollow`. |

Availability searches used the published GET form and its `yyyy-mm-dd` transfer format. No reservation submission followed.

| Dates | Server result |
| --- | --- |
| 22 to 29 October 2026 | One accommodation, EUR 3,010 for seven nights. |
| 22 to 23 October 2026 | No accommodation, consistent with the published seven-night minimum. |
| 15 to 22 October 2026 | No accommodation, consistent with the published seven-day notice. |
| 1 to 8 June 2027 | One accommodation, EUR 3,500 for seven nights. |

## Content issues found

1. **Contradictory arrival address, corrected.** The initial [English location page](https://villa-claudia.eu/location/) and [German location page](https://villa-claudia.eu/de/location/) told guests to navigate to `Bronobići 94A`, conflicting with `Valentići 32`. The owner confirmed `Valentići 32`. Follow-up updates changed both language versions to that address and replaced the unverified fixed border-opening hours with a request to check current traffic and road conditions. Both public pages returned HTTP 200 with the correct address and without the old address or fixed hours.
2. **Incomplete German translation, main pages corrected.** The initial cancellation/refund paragraph on [German booking](https://villa-claudia.eu/de/booking/), [German booking terms](https://villa-claudia.eu/de/booking-terms/), and restaurant descriptions on [German restaurants](https://villa-claudia.eu/de/restaurants/) were English. Follow-up updates translated this policy copy, the complete terms page, and all 22 displayed restaurant descriptions and their labels. The English source policy was preserved. Private backups preceded the native TranslatePress saves. Follow-up HTTP checks confirmed the translated text. The rates table's season names and `Important` label still need a separate check.
3. **Rates presentation fixed.** Initially [Rates](https://villa-claudia.eu/rates/) listed only 2026 while the availability search already offered June 2027. Rates Display 1.9.5 now shows labelled 2026 and 2027 tables on the English and German pages. It reads MotoPress's actual recurring periods and prices, including the booking horizon. The observed 2026 October rate agrees with the seven-night search total.
4. **Restaurant location contradiction.** The restaurants list gives Hrast an address in Poreč but describes it as being in Rovinj. Verify the venue description before correcting it.
5. **Heading structure.** The home page has two H1 headings, one for the introduction and another for the repeated booking call to action. The gallery has no page-specific heading in the server HTML. Location starts with H2. These are accessibility and navigation improvements, rather than evidence of a broken booking flow.

The linked [booking terms](https://villa-claudia.eu/booking-terms/) page is available. Generic guessed paths `/privacy-policy/` and `/terms-and-conditions/` returned 404, but they were not linked from the pages inspected. This does not prove that all privacy or provider information is absent. The document upload pages inspected contain no visible link to information about document use, recipients or retention. Review the actual data handling and publish accurate information rather than inventing retention periods.

## Not established by these checks

- Desktop and mobile appearance, keyboard interaction, date-picker behavior, gallery lightboxes and client-side browser errors.
- Completion of the booking checkout, Stripe payment, payment webhook, cancellation or refund.
- The contents or validity of existing customer bookings and documents.
- End-to-end reminder delivery, guest notification or authority registration.
- Correctness of every restaurant recommendation, driving instruction or commercial condition.
- Every image variant, third-party asset and outbound external link.

## Mail transport and public DNS

The passwords in the original DOCX were read in memory and used only to authenticate to Hostinger's `imap.hostinger.com` on port 993. Password values were not copied into this report or the evidence files. All four sign-ins succeeded with certificate verification and TLS 1.3. The checks logged out immediately after authentication. They did not select a mailbox, read messages or send email.

| Mailbox | IMAP authentication with original document password |
| --- | --- |
| administration@villa-claudia.eu | Accepted |
| booking@villa-claudia.eu | Accepted |
| info@villa-claudia.eu | Accepted |
| no-reply@villa-claudia.eu | Accepted |

Separate SMTP authentication checks in the parent audit also accepted these four credentials over verified TLS. Authentication establishes that these mailbox credentials work. It does not establish delivery to an external recipient or confirm that application configuration uses the same password.

Public DNS and Hostinger's read-only DNS zone inventory agreed on the following records.

| Record | Verified value or result |
| --- | --- |
| MX | `mx1.hostinger.com`, priority 5, and `mx2.hostinger.com`, priority 10. |
| SPF | One root SPF record, `v=spf1 include:_spf.mail.hostinger.com ~all`. The referenced Hostinger SPF record resolved. |
| DMARC | `v=DMARC1; p=none`. This publishes a monitoring policy, without a reporting address in the observed record. |
| DKIM selector discovery | Hostinger's DNS inventory explicitly listed `hostingermail-a`, `hostingermail-b` and `hostingermail-c`. Selectors were not guessed. |
| DKIM selector a | CNAME resolved to `hostingermail-a.dkim.mail.hostinger.com`, whose TXT record contains a nonempty RSA public key. |
| DKIM selectors b and c | CNAME targets resolved and each published `v=DKIM1;p=` with an empty key. This report does not assume they are currently used for signing. |

No DNS changes were made. These records do not prove that a particular outgoing message was DKIM-signed, passed SPF or DMARC alignment, or reached an inbox. That requires a delivered test message and its received authentication headers. Mail delivery remains a separate end-to-end check.

## Production server configuration

Read-only SSH checks examined the production WordPress installation. They did not run scheduled jobs, change settings or update software.

| Check | Observed result |
| --- | --- |
| Plugins and theme | 23 standard plugins, 21 active and two inactive. No pending updates reported. Divi 4.27.9 active, with no pending update reported. Two must-use Hostinger plugins and an object-cache drop-in were also listed. |
| WordPress core integrity | Core verification passed against official WordPress checksums. |
| Plugin integrity | 15 of 23 plugins passed published checksums. Eight were skipped because WordPress.org did not publish checksums for those versions. A skip is not an integrity pass or a detected mismatch. |
| Site timezone | `Europe/Zagreb`. |
| WordPress administrator email | `administration@villa-claudia.eu`. |
| MotoPress configured sender | `booking@villa-claudia.eu`, display name `Booking @ Villa Claudia`. |
| Effective WordPress SMTP sender | The document plugin configures both authentication and the From address as `administration@villa-claudia.eu`, using `smtp.hostinger.com`, port 465, implicit TLS. Thus the effective sender differs from the MotoPress setting. |
| Actual WordPress SMTP credentials | Authentication with the effective configured password succeeded using the PHP mail library's default peer verification. The check connected, authenticated and disconnected without sending a message. |
| Document API and SMTP secrets | Both effective settings were present. Their values were not printed. |
| Authority forwarding recipient | The effective recipient is a private mailbox. Its address is omitted from this public report. The check did not establish that it is an approved authority destination. Sending documents there must not be described as completed statutory guest registration. |
| Calendar synchronization | MotoPress automatic iCal synchronization is enabled with `vc_five_minutes`. The actual WordPress scheduled event also reports a five-minute recurrence. |
| Reminder entry script | The deployed script contains a CLI-only guard and writes its own log outside `public_html`, in the domain's `private-logs` directory. The script was not executed. |
| System cron inventory | The SSH environment does not provide the `crontab` command. The system schedule could not be verified there. Hostinger's cron-job panel must supply that evidence. |

The eight plugin checksum skips were Hostinger AI Assistant, Hostinger Easy Onboarding, MotoPress Hotel Booking, MotoPress Checkout Fields, MotoPress WooCommerce integration, and the three custom Villa Claudia plugins. Premium and custom plugin integrity needs comparison with their actual trusted distributions or repository files.

Only HEAD requests checked sensitive production paths. No log or configuration response bodies were read.

| Public path | HTTP result at inspection |
| --- | --- |
| `/.env.cron` | 403 |
| `/.private/config.json` | 403 |
| `/logs/` | 403 |
| `/logs/.htaccess` | 403 |
| `/cron-document-reminders.php` | 403 |
| `/error_log` | Initially 200, Content-Length 751 bytes, matching the on-disk file size. The parent audit added an access restriction. A fresh HEAD request confirmed **403** afterward. Its contents were never read. |

The `logs` and `.private` directories contain deny-all access rules. The observed `.env.cron`, `.private/config.json` and `error_log` files had mode `0644`; the logs directory had mode `0755`. HTTP denial was confirmed for the configuration files and, after remediation, for `error_log`.

## Rates display remediation

The Rates page uses `[villa_claudia_rates]` without a fixed year. The old plugin selected only the current year. It also filtered recurring seasons using their original start and end dates, overlooking the periods that MotoPress generates for later years.

Rates Display 1.9.5 fixes both problems. The default shortcode shows the current and following year when matching prices exist. An explicit `year` remains a single-year filter. Recurring seasons use the installed MotoPress `RecurrentSeason::getPeriods()` result, rather than copying dates into another year. This preserves the vendor's recurrence end dates and booking horizon. Nonrecurring seasons keep their existing year filter. Neither rates, season options nor page content changed.

At verification, the live data supplied seven rows for 2026 and six for 2027, ending on 15 October 2027 under MotoPress's generated horizon. Prices remained EUR 430, EUR 500 and EUR 600 per night according to the original rate entries. Both public language pages returned HTTP 200 with two labelled tables after deployment. No page-cache purge was needed.

Fourteen PHP assertions pass, covering price formatting, current and next year selection, explicit filtering, missing years, recurring periods, recurrence cutoffs, cross-year clipping and preservation of vendor date objects. The candidate also rendered against the live WordPress data in an isolated CLI process before deployment. Local and server PHP syntax checks passed.

The live plugin and Rates page were backed up in a private directory outside the public web root, with mode `0600` on backup files. The account-specific restore location is kept privately. Deployment checked that the original plugin hash still matched the backup, verified the uploaded candidate hash, then replaced only the rates plugin file atomically. The repository's installable ZIP was rebuilt from the same source. Its recovery instructions now use deactivation and backup restoration.
