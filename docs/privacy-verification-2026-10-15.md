# Privacy workflow verification, 15 October 2026

The guest portal now shows arrival registration guidance by default. It offers an identity-copy form only for an active documented exception for the named lead adult. The form accepts one file and voluntary agreement for that exact case. Guests can choose original-document inspection or withdraw and delete the copy from the same private page.

The form does not collect a separate identity-document number. Next.js strips unexpected metadata before forwarding. WordPress stores a generic original filename and an empty legacy number field. Notifications contain only the booking reference and an administration link, without copies, guest names, email addresses or document numbers.

## Verified behavior

- 58 Node tests cover the private token workflow, exception authorization before body parsing, stale cases, agreement, canonical adult identity, single-file limits, duplicate rejection, withdrawal receipts, reminder delivery claims, bilingual policy rendering, and checkout browser-storage cleanup.
- The PHP suites pass 260 assertions on Windows. The symlink-preservation assertion cannot create its fixture on this Windows environment. On the hosting system, PHP also disables symlink creation. A separate isolated test used an SSH-created synthetic link and confirmed that the same erasure helper preserved both the link and its target. This adds the missing platform check without following or reading any real document.
- 22 mobile Chromium checks run the built Next.js application against synthetic loopback WordPress responses. They cover default guidance without file fields, the readonly adult name, optional agreement, one-file upload, withdrawal, no upload form after deletion, both policy languages, canonical policy text, and absence of page errors or horizontal overflow.
- 19 checks exercised the actual QA WordPress REST API with synthetic confirmed bookings and a PDF containing no personal data. Ordinary uploads, stale cases, missing agreement, another adult and duplicates were rejected. The authorized file had mode `0600` in a `0700` directory outside WordPress. Withdrawal removed its file and metadata. An expired case was erased during canonical lookup. Repeated withdrawal succeeded safely. All synthetic bookings were recoverably trashed and all synthetic copies were removed.
- 13 further checks ran the built Next.js server against the real QA WordPress API. They verified the ordinary no-upload page, forbidden routine upload, recorded-case single-PDF upload through Next.js, actual protected storage, same-page withdrawal, physical deletion, no upload form after withdrawal and rejection of further copies. SMTP was disabled with a fake administrator recipient. The synthetic booking was trashed, copies deleted, temporary credentials removed and the local server stopped.
- Multipart regressions expire the case during status persistence and after agreement persistence. Both reject completion and roll back the file and document records.
- Restore-erasure tests require the approved relative-path hash and exact file size. They preserve unapproved files, size mismatches and symlinks, and report invalid receipts.

Node 22 production build and lint passed. The QA backend test finished at 18:59 UTC. All temporary local servers and remote test files were removed after verification.

## Reproduce

Run the Node tests, lint and production build with Node 22. CI runs the PHP suites from `.github/workflows/validate.yml`.

For the optional browser regression, install Python Playwright and Chromium, build the app, then run:

```text
python tests/registration-browser.py --node <Node-22-executable>
```

Use `--chrome <Chromium-executable>` to select an installed browser. The test starts only loopback services, uses synthetic data, disables email and cleans up its own processes and temporary directory.

After both public sites are deployed, compare their policy bodies against the canonical JSON with anonymous read-only requests:

```text
python tests/verify-privacy-publication.py --next-base https://documents.villa-claudia.eu --wordpress-en https://villa-claudia.eu/privacy-policy/ --wordpress-de https://villa-claudia.eu/de/datenschutz/
```

The canonical policy is `content/privacy-policy.json`. Both renderers use explicit language wrappers. Production publication and all four URL comparisons passed on application revision `700b70f7eb58c76e591060ceb3f58a4ff61a84b8`. Hostinger completed its matching build at 19:14:05 UTC. WordPress runs Docs 1.8.0 and privacy defaults 1.0.1. The five-minute retention job ran automatically at 19:10:04 UTC with zero failures. See [operations](operations.md#privacy-release-verification) for the deployment and scoped production checks.
