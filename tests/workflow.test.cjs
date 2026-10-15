/* eslint-disable @typescript-eslint/no-require-imports -- isolated CommonJS test loader */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const token = 'vc_' + 'a'.repeat(64);
const booking = { bookingId: 42, guestName: 'Synthetic Guest', guestEmail: 'guest@example.invalid', checkInDate: '2026-09-29', checkOutDate: '2026-10-06', status: 'confirmed', copyException: { active: true, expiresAt: '2099-10-15T12:00:00Z', reason: 'Synthetic documented exception', travelerName: 'Synthetic Guest', hasCopies: false, caseId: 'synthetic-case' } };
function loader({ fetch, mail = async () => ({ accepted: ['admin@example.invalid'] }), env = {} } = {}) {
  const cache = new Map();
  const environment = { WORDPRESS_API_URL: 'https://wp.invalid/wp-json/villa-claudia/v1', WORDPRESS_API_KEY: 'synthetic-key', NEXT_PUBLIC_BASE_URL: 'https://documents.invalid', EMAIL_HOST: 'smtp.invalid', EMAIL_USER: 'synthetic', EMAIL_PASSWORD: 'synthetic', ...env };
  function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const customRequire = name => {
      if (name === 'next/server') return { NextResponse: { json: (body, init = {}) => new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } }) } };
      if (name === 'nodemailer') return { createTransport: config => ({ sendMail: data => mail(data, config) }) };
      if (name === '@/components/privacy-links') return { __esModule: true, default: 'PrivacyLinks' };
      if (name === '@/components/document-upload-form') return { __esModule: true, default: 'DocumentUploadForm' };
      if (name.startsWith('@/')) {
        const sourcePath = name.slice(2);
        return load(sourcePath + (fs.existsSync(path.resolve(root, sourcePath + '.ts')) ? '.ts' : '.tsx'));
      }
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'));
      return require(name);
    };
    vm.runInNewContext(source, { module: mod, exports: mod.exports, require: customRequire, process: { env: environment },
      console: { log() {}, error() {}, warn() {} }, URL, Headers, Request, Response, AbortSignal, FormData, File, Blob, Buffer, Uint8Array, Intl, Date, fetch }, { filename: file });
    return mod.exports;
  }
  return load;
}
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
const uploadHeaders = { 'x-booking-token': token, 'x-copy-agreement': 'true', 'x-copy-case-id': 'synthetic-case' };
function uploadRequest(id = token, count = 1, documentNumber = 'NOT-AN-ID') {
  const form = new FormData(); form.set('bookingId', id); form.set('copyAgreement', 'true'); form.set('copyCaseId', 'synthetic-case');
  form.set('guestName', 'Attacker-chosen name'); form.set('email', 'different@example.invalid');
  for (let i = 0; i < count; i++) {
    form.append('files', new File(['%PDF-1.4\nsynthetic fixture'], 'same-name.pdf', { type: 'application/pdf' }));
    form.set(`fileMetadata[${i}]`, JSON.stringify({ travelerName: 'Synthetic Guest', documentType: 'passport', documentNumber }));
  }
  return new Request('https://local.invalid/api/upload', { method: 'POST', body: form, headers: { ...uploadHeaders, 'x-booking-token': id } });
}
test('national ID selection includes EU, EEA and Swiss guests without allowing unrelated citizenships', () => {
  const { acceptsNationalId } = loader()('components/document-upload-form.tsx');
  for (const country of ['at', 'de', 'hr', 'no', 'is', 'li', 'ch']) assert.equal(acceptsNationalId(country), true);
  for (const country of ['gb', 'us', 'other', '']) assert.equal(acceptsNationalId(country), false);
});
test('numeric, malformed, uppercase and encoded tokens are rejected before backend access', async () => {
  let calls = 0;
  const load = loader({ fetch: async () => { calls++; return json(booking); } });
  for (const bad of ['420000000000000000', token.toUpperCase(), 'vc_%61' + 'a'.repeat(63), '../42', '']) {
    await assert.rejects(load('lib/wordpress.ts').resolveBooking(bad));
    const response = await load('app/api/upload/route.ts').POST(uploadRequest(bad));
    assert.equal(response.status, 404);
  }
  assert.equal(calls, 0);
});
test('booking route uses opaque lookup, no cache and keeps key only in request headers', async () => {
  let seen;
  const load = loader({ fetch: async (url, init) => { seen = { url, init }; return json(booking); } });
  const response = await load('app/api/booking/route.ts').GET(new Request('https://local.invalid/api/booking?id=' + token));
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(seen.url, 'https://wp.invalid/wp-json/villa-claudia/v1/secure-booking/' + token);
  assert.equal(seen.init.cache, 'no-store'); assert.equal(seen.init.headers.get('x-api-key'), 'synthetic-key');
  assert.equal((await response.json()).bookingId, 42);
});
test('backend rejects cancelled/expired links for API, page and upload', async () => {
  let mailCount = 0;
  const load = loader({ fetch: async () => json({ error: 'expired' }, 404), mail: async () => { mailCount++; } });
  assert.equal((await load('app/api/booking/route.ts').GET(new Request('https://local.invalid/api/booking?id=' + token))).status, 404);
  assert.equal((await load('app/api/upload/route.ts').POST(uploadRequest())).status, 404);
  const page = await load('app/uploads/[secureBookingId]/page.tsx').default({ params: Promise.resolve({ secureBookingId: token }) });
  assert.match(JSON.stringify(page), /Unable to open/); assert.equal(mailCount, 0);
});
test('valid guest page resolves token and renders the correct booking', async () => {
  const load = loader({ fetch: async () => json(booking) });
  const page = await load('app/uploads/[secureBookingId]/page.tsx').default({ params: Promise.resolve({ secureBookingId: token }) });
  const text = JSON.stringify(page); assert.match(text, /DocumentUploadForm/); assert.match(text, /VC-42/);
});
test('storage failure, false success and partial counts never send mail or report success', async () => {
  for (const outcome of [() => json({}, 500), () => json({ success: false, storedCount: 1, bookingId: 42 }), () => json({ success: true, storedCount: 0, bookingId: 42 })]) {
    let mails = 0;
    const load = loader({ fetch: async url => url.includes('secure-booking') ? json(booking) : outcome(), mail: async () => { mails++; } });
    const response = await load('app/api/upload/route.ts').POST(uploadRequest());
    assert.equal(response.status, 502); assert.equal((await response.json()).success, false); assert.equal(mails, 0);
  }
});
test('lost upload response reports uncertain storage without encouraging a blind retry', async () => {
  const load = loader({ fetch: async url => {
    if (url.includes('secure-booking')) return json(booking);
    throw new Error('Synthetic connection lost after storage');
  } });
  const response = await load('app/api/upload/route.ts').POST(uploadRequest());
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /contact Villa Claudia before uploading again/);
});
test('upstream upload gateway errors and unreadable acknowledgements require reconciliation', async () => {
  for (const outcome of [() => json({}, 504), () => new Response('interrupted JSON')]) {
    const load = loader({ fetch: async url => url.includes('secure-booking') ? json(booking) : outcome() });
    const response = await load('app/api/upload/route.ts').POST(uploadRequest());
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /contact Villa Claudia before uploading again/);
  }
});
test('WordPress file validation errors do not tell guests their valid link has expired', async () => {
  const load = loader({ fetch: async url => url.includes('secure-booking') ? json(booking) : json({ code: 'invalid_file' }, 400) });
  const response = await load('app/api/upload/route.ts').POST(uploadRequest());
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /document could not be validated/);
  assert.doesNotMatch(body.error, /link.*expired/);
});
test('stored upload survives notification failure and forwards token, not caller booking ID', async () => {
  let upstream;
  const load = loader({ fetch: async (url, init) => {
    if (url.includes('secure-booking')) return json(booking);
    upstream = init.body; return json({ success: true, storedCount: 1, bookingId: 42 });
  }, mail: async () => { throw new Error('SMTP down'); } });
  const response = await load('app/api/upload/route.ts').POST(uploadRequest());
  const body = await response.json();
  assert.equal(response.status, 201); assert.equal(body.wordpressStorage, true); assert.equal(body.notificationSent, false);
  assert.match(body.message, /do not need to upload again/); assert.equal(upstream.get('uploadToken'), token); assert.equal(upstream.has('bookingId'), false);
});
test('successful upload notifies with canonical booking data and strict TLS', async () => {
  let sent;
  const load = loader({ fetch: async url => url.includes('secure-booking') ? json(booking) : json({ success: true, storedCount: 1, bookingId: 42 }),
    mail: async (data, config) => { sent = { data, config }; return { accepted: ['admin@example.invalid'] }; } });
  const result = await (await load('app/api/upload/route.ts').POST(uploadRequest())).json();
  assert.equal(result.notificationSent, true); assert.match(sent.data.text, /booking VC-42/); assert.match(sent.data.text, /https:\/\/wp.invalid\/wp-admin\/post.php\?post=42&action=edit/); assert.doesNotMatch(sent.data.text, /guest@example.invalid|Synthetic Guest|NOT-AN-ID/); assert.equal(sent.data.attachments, undefined); assert.doesNotMatch(sent.data.text, /different@example.invalid/);
  assert.equal(sent.config.tls.rejectUnauthorized, true); assert.equal(sent.config.requireTLS, true); assert.equal(sent.config.debug, false);
});
test('a second identity file is rejected without storage or notification', async () => {
  let mails = 0, uploads = 0;
  const load = loader({ fetch: async url => { if (url.includes('secure-booking')) return json(booking); uploads++; }, mail: async () => { mails++; } });
  assert.equal((await load('app/api/upload/route.ts').POST(uploadRequest(token, 2))).status, 400);
  assert.equal(uploads, 0); assert.equal(mails, 0);
});

test('guest upload receipts preserve controlled errors and reconcile lost or malformed acknowledgements', async () => {
  const form = new FormData();
  const good = loader({ fetch: async () => json({ success: true, wordpressStorage: true, message: 'Saved without notification' }, 201) });
  assert.equal(await good('lib/submit-documents.ts').submitDocuments(form), 'Saved without notification');
  const rejected = loader({ fetch: async () => json({ success: false, error: 'Choose a readable file' }, 400) });
  await assert.rejects(rejected('lib/submit-documents.ts').submitDocuments(form), /Choose a readable file/);
  for (const fetch of [async () => { throw new TypeError('Failed to fetch'); }, async () => new Response('gateway HTML'), async () => json(null), async () => json({ success: true })]) {
    await assert.rejects(loader({ fetch })('lib/submit-documents.ts').submitDocuments(form), /contact Villa Claudia before uploading again/);
  }
});
test('oversized request and excessive file count are rejected', async () => {
  const load = loader({ fetch: async () => json(booking) });
  const request = new Request('https://local.invalid/api/upload', { method: 'POST', body: 'small', headers: { ...uploadHeaders, 'Content-Length': String(28 * 1024 * 1024) } });
  assert.equal((await load('app/api/upload/route.ts').POST(request)).status, 413);
  assert.equal((await load('app/api/upload/route.ts').POST(uploadRequest(token, 9))).status, 400);
});
test('redundant identity numbers and arbitrary metadata are never forwarded to WordPress', async () => {
  let upstream;
  const load = loader({ fetch: async (url, init) => { if (url.includes('secure-booking')) return json(booking); upstream = init.body; return json({ success: true, storedCount: 1, bookingId: 42 }); } });
  const form = await uploadRequest().formData();
  form.set('fileMetadata[0]', JSON.stringify({ travelerName: 'Synthetic Guest', documentType: 'passport', documentNumber: 'MUST-NOT-PERSIST', arbitrary: 'MUST-NOT-PERSIST' }));
  assert.equal((await load('app/api/upload/route.ts').POST(new Request('https://local.invalid/api/upload', { method: 'POST', headers: uploadHeaders, body: form }))).status, 201);
  assert.deepEqual(JSON.parse(upstream.get('file_info_file_0')), { travelerName: 'Synthetic Guest', documentType: 'passport' });
});

test('cron fails closed when unconfigured, denies wrong secrets and surfaces backend errors', async () => {
  const request = new Request('https://local.invalid/api/cron/document-reminders');
  assert.equal((await loader()('app/api/cron/document-reminders/route.ts').GET(request)).status, 503);
  const load = loader({ env: { CRON_SECRET: 'synthetic' }, fetch: async () => json({}, 404) });
  assert.equal((await load('app/api/cron/document-reminders/route.ts').GET(request)).status, 401);
  const authorized = new Request(request.url, { headers: { authorization: 'Bearer synthetic' } });
  assert.equal((await load('app/api/cron/document-reminders/route.ts').POST(authorized)).status, 502);
});
test('reminders use Zagreb calendar days across midnight/DST and catch up for seven days', () => {
  const { reminderDue } = loader()('lib/document-scheduler.ts');
  const now = new Date('2026-09-22T22:30:00Z'); // Already September 23 in Zagreb.
  assert.equal(reminderDue('2026-09-30', now), true); assert.equal(reminderDue('2026-10-01', now), false);
  assert.equal(reminderDue('2026-09-23', now), true); assert.equal(reminderDue('2026-09-22', now), false);
  assert.equal(reminderDue('2026-10-25', new Date('2026-10-18T08:00:00Z')), true);
});
test('completed and concurrent reminder runs do not resend; ambiguous mail retains its claim', async () => {
  let state = 'unclaimed', mails = 0;
  const fetch = async (url, init) => {
    if (url.endsWith('/bookings/upcoming')) return json([{ ...booking, reminderSent: state === 'sent' }]);
    if (url.endsWith('/reminders/claim')) {
      if (state !== 'unclaimed') return json({ claimed: false, pending: state === 'claimed' });
      state = 'claimed'; return json({ claimed: true, claimId: 'synthetic', uploadToken: token, booking });
    }
    assert.equal(JSON.parse(init.body).delivered, true); state = 'sent'; return json({ success: true });
  };
  const load = loader({ fetch, mail: async () => { mails++; return { accepted: ['guest@example.invalid'] }; } });
  const run = load('lib/document-scheduler.ts').processDocumentReminders;
  await Promise.all([run(new Date('2026-09-22T12:00Z')), run(new Date('2026-09-22T12:00Z'))]);
  await run(new Date('2026-09-22T12:00Z')); assert.equal(mails, 1); assert.equal(state, 'sent');
  state = 'unclaimed';
  const failed = loader({ fetch, mail: async () => { throw Error('uncertain SMTP disconnect'); } });
  assert.equal((await failed('lib/document-scheduler.ts').processDocumentReminders(new Date('2026-09-22T12:00Z'))).failed, 1);
  assert.equal(state, 'claimed');
});

test('reminder uses the claim recipient and retries definitive SMTP rejection', async () => {
  let completed, recipient;
  const fetch = async (url, init) => {
    if (url.endsWith('/bookings/upcoming')) return json([booking]);
    if (url.endsWith('/reminders/claim')) return json({ claimed: true, claimId: 'claim', uploadToken: token, booking: { ...booking, guestEmail: 'corrected@example.invalid' } });
    completed = JSON.parse(init.body); return json({ success: true });
  };
  const load = loader({ fetch, mail: async data => { recipient = data.to; throw Object.assign(new Error('Auth rejected'), { code: 'EAUTH', responseCode: 535 }); } });
  const result = await load('lib/document-scheduler.ts').processDocumentReminders(new Date('2026-09-22T12:00Z'));
  assert.equal(recipient, 'corrected@example.invalid'); assert.equal(completed.delivered, false); assert.equal(result.failed, 1);
});
test('generic SMTP connection errors after DATA keep the reminder claim for reconciliation', async () => {
  for (const code of ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET']) {
    let completions = 0;
    const load = loader({ fetch: async url => {
      if (url.endsWith('/bookings/upcoming')) return json([booking]);
      if (url.endsWith('/reminders/claim')) return json({ claimed: true, claimId: 'claim', uploadToken: token, booking });
      completions++; return json({ success: true });
    }, mail: async () => {
      throw Object.assign(new Error('Connection closed unexpectedly'), { code, command: 'CONN' });
    } });
    const result = await load('lib/document-scheduler.ts').processDocumentReminders(new Date('2026-09-22T12:00Z'));
    assert.equal(result.failed, 1);
    assert.equal(completions, 0);
  }
});
test('missing SMTP configuration fails before consuming any reminder claim', async () => {
  let claims = 0;
  const load = loader({ env: { EMAIL_PASSWORD: '' }, fetch: async url => { if (!url.endsWith('/bookings/upcoming')) claims++; return json([booking]); } });
  assert.equal((await load('lib/document-scheduler.ts').processDocumentReminders(new Date('2026-09-22T12:00Z'))).failed, 1);
  assert.equal(claims, 0);
});

test('every malformed storage acknowledgement requires reconciliation without sending mail', async () => {
  for (const receipt of [null, [], true, 'saved', { success: true, storedCount: 1, bookingId: 43 }]) {
    let mails = 0;
    const load = loader({ fetch: async url => url.includes('secure-booking') ? json(booking) : json(receipt), mail: async () => { mails++; } });
    const response = await load('app/api/upload/route.ts').POST(uploadRequest());
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /contact us before retrying/);
    assert.equal(mails, 0);
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
});

test('invalid booking response shapes fail as upstream errors before exposing a form', async () => {
  for (const receipt of [null, [], true, { ...booking, bookingId: -1 }, { ...booking, guestEmail: null }, { ...booking, guestName: null }]) {
    const load = loader({ fetch: async () => json(receipt) });
    const response = await load('app/api/booking/route.ts').GET(new Request('https://local.invalid/api/booking?id=' + token));
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /Invalid response/);
  }
});

test('invalid or absent multipart bodies fail after canonical authorization and before storage', async () => {
  let requests = 0;
  const load = loader({ fetch: async () => { requests++; return json(booking); } });
  for (const request of [new Request('https://local.invalid/api/upload', { method: 'POST', headers: uploadHeaders }), new Request('https://local.invalid/api/upload', { method: 'POST', body: 'not multipart', headers: { ...uploadHeaders, 'content-type': 'multipart/form-data; boundary=missing' } })]) {
    assert.equal((await load('app/api/upload/route.ts').POST(request)).status, 400);
  }
  assert.equal(requests, 2);
});

test('streamed oversized requests are bounded even when content length is missing or understated', async () => {
  let requests = 0;
  const load = loader({ fetch: async () => { requests++; return json(booking); } });
  for (const headers of [{}, { 'content-length': '1' }]) {
    const request = new Request('https://local.invalid/api/upload', { method: 'POST', body: new Uint8Array(27 * 1024 * 1024 + 1), headers: { ...uploadHeaders, ...headers } });
    assert.equal((await load('app/api/upload/route.ts').POST(request)).status, 413);
  }
  assert.equal(requests, 2);
});

test('file type, empty file, individual size and metadata limits fail before storage', async () => {
  let uploads = 0;
  const load = loader({ fetch: async url => {
    if (url.includes('secure-booking')) return json(booking);
    uploads++; return json({ success: true, storedCount: 1, bookingId: 42 });
  } });
  const cases = [
    { file: new File(['synthetic'], 'bad.html', { type: 'text/html' }) },
    { file: new File([], 'empty.pdf', { type: 'application/pdf' }) },
    { file: new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' }) },
    { metadata: 'null' }, { metadata: 'invalid JSON' },
    { metadata: JSON.stringify({ travelerName: ' ', documentType: 'passport', documentNumber: 'TEST' }) },
    { metadata: JSON.stringify({ travelerName: 'x'.repeat(201), documentType: 'passport', documentNumber: 'TEST' }) },
    { metadata: JSON.stringify({ travelerName: 'Synthetic Guest', documentType: 'unknown' }) },
    { metadata: JSON.stringify({ travelerName: 'Synthetic Guest', documentType: 'residence_permit' }) },
    { metadata: JSON.stringify({ travelerName: 'Synthetic Guest', documentType: 'drivers_license' }) },
  ];
  for (const scenario of cases) {
    const form = await uploadRequest().formData();
    if (scenario.file) form.set('files', scenario.file);
    if (scenario.metadata) form.set('fileMetadata[0]', scenario.metadata);
    assert.equal((await load('app/api/upload/route.ts').POST(new Request('https://local.invalid/api/upload', { method: 'POST', body: form, headers: uploadHeaders }))).status, 400);
  }
  assert.equal(uploads, 0);
});

test('multiple large documents are rejected by the single guest limit before storage', async () => {
  let uploads = 0;
  const load = loader({ fetch: async url => { if (url.includes('secure-booking')) return json(booking); uploads++; } });
  const form = await uploadRequest(token, 3).formData();
  form.delete('files');
  for (let i = 0; i < 3; i++) form.append('files', new File([new Uint8Array(8.5 * 1024 * 1024)], `synthetic-${i}.pdf`, { type: 'application/pdf' }));
  assert.equal((await load('app/api/upload/route.ts').POST(new Request('https://local.invalid/api/upload', { method: 'POST', body: form, headers: uploadHeaders }))).status, 400);
  assert.equal(uploads, 0);
});

test('unaccepted notification preserves saved documents and explicitly warns the guest', async () => {
  const load = loader({ fetch: async url => url.includes('secure-booking') ? json(booking) : json({ success: true, storedCount: 1, bookingId: 42 }), mail: async () => ({ accepted: [], rejected: ['admin@example.invalid'] }) });
  const response = await load('app/api/upload/route.ts').POST(uploadRequest());
  const receipt = await response.json();
  assert.equal(response.status, 201);
  assert.equal(receipt.wordpressStorage, true);
  assert.equal(receipt.notificationSent, false);
  assert.match(receipt.message, /do not need to upload again/);
});

test('SMTP ports and secure URL requirements fail closed', () => {
  for (const env of [{ EMAIL_PORT: '25' }, { EMAIL_PORT: 'NaN' }, { NEXT_PUBLIC_BASE_URL: 'http://documents.invalid' }, { NEXT_PUBLIC_BASE_URL: '' }, { EMAIL_HOST: '' }, { EMAIL_USER: '' }]) {
    assert.throws(() => loader({ env })('lib/email-config.ts').createEmailTransporter());
  }
});

test('implicit TLS port and configured sender are used for reminder mail', async () => {
  let sent;
  const load = loader({ env: { EMAIL_PORT: '465', EMAIL_FROM: 'Villa Test <test@example.invalid>' }, mail: async (data, config) => { sent = { data, config }; return { accepted: ['guest@example.invalid'] }; } });
  const receipt = await load('lib/email-config.ts').sendDocumentRequestEmail(token, booking.guestEmail, booking.guestName, new Date('2026-09-29T12:00:00Z'));
  assert.equal(receipt.success, true);
  assert.equal(sent.config.secure, true);
  assert.equal(sent.config.requireTLS, false);
  assert.equal(sent.data.from, 'Villa Test <test@example.invalid>');
  assert.match(sent.data.text, new RegExp('/uploads/' + token));
});

test('reminder completion failure retains uncertainty and never reports sent', async () => {
  let mails = 0;
  const load = loader({ fetch: async url => {
    if (url.endsWith('/bookings/upcoming')) return json([booking]);
    if (url.endsWith('/reminders/claim')) return json({ claimed: true, claimId: 'claim', uploadToken: token, booking });
    return json({}, 500);
  }, mail: async () => { mails++; return { accepted: [booking.guestEmail] }; } });
  const result = await load('lib/document-scheduler.ts').processDocumentReminders(new Date('2026-09-22T12:00Z'));
  assert.equal(mails, 1); assert.equal(result.failed, 1); assert.equal(result.sent, 0);
});

test('ineligible, already uploaded and already reminded bookings never acquire a claim', async () => {
  let claims = 0;
  const load = loader({ fetch: async url => {
    if (url.endsWith('/bookings/upcoming')) return json([{ ...booking, status: 'cancelled' }, { ...booking, hasUploadedDocuments: true }, { ...booking, reminderSent: true }, { ...booking, checkInDate: '2026-10-10' }, { ...booking, guestEmail: '' }]);
    claims++; throw new Error('Unexpected claim');
  } });
  const result = await load('lib/document-scheduler.ts').processDocumentReminders(new Date('2026-09-22T12:00Z'));
  assert.equal(claims, 0); assert.equal(result.processed, 0); assert.equal(result.skipped, 1);
});

test('missing WordPress configuration and invalid backend JSON fail closed', async () => {
  for (const env of [{ WORDPRESS_API_URL: '' }, { WORDPRESS_API_KEY: '' }]) {
    await assert.rejects(loader({ env })('lib/wordpress.ts').resolveBooking(token), error => error.status === 503);
  }
  await assert.rejects(loader({ fetch: async () => new Response('not JSON') })('lib/wordpress.ts').resolveBooking(token), error => error.status === 502 && /Invalid response/.test(error.message));
  await assert.rejects(loader({ fetch: async () => { throw new Error('Synthetic network outage'); } })('lib/wordpress.ts').resolveBooking(token), error => error.status === 503 && /temporarily unavailable/.test(error.message));
  for (const status of [400, 403, 404, 410, 401, 429, 500]) {
    await assert.rejects(loader({ fetch: async () => json({}, status) })('lib/wordpress.ts').resolveBooking(token), error => error.status === ([400, 403, 404, 410].includes(status) ? status : 502));
  }
});

test('reminders reject invalid lists and claim snapshots without sending mail', async () => {
  await assert.rejects(loader({ fetch: async () => json({ bookings: [] }) })('lib/document-scheduler.ts').processDocumentReminders(), /Invalid upcoming bookings/);
  for (const claim of [{ claimed: false }, { claimed: true }, { claimed: true, claimId: 'claim', uploadToken: token, booking: { ...booking, bookingId: 99 } }]) {
    let mails = 0;
    const load = loader({ fetch: async url => url.endsWith('/bookings/upcoming') ? json([booking]) : json(claim), mail: async () => { mails++; } });
    const result = await load('lib/document-scheduler.ts').processDocumentReminders(new Date('2026-09-22T12:00Z'));
    assert.equal(mails, 0);
    assert.equal(claim.claimed ? result.failed : result.skipped, 1);
  }
});

test('reminder email validates tokens and public URLs before sending', async () => {
  for (const [id, env] of [['42', {}], [token, { NEXT_PUBLIC_BASE_URL: '' }], [token, { NEXT_PUBLIC_BASE_URL: 'http://documents.invalid' }]]) {
    let mails = 0;
    const load = loader({ env, mail: async () => { mails++; } });
    await assert.rejects(load('lib/email-config.ts').sendDocumentRequestEmail(id, booking.guestEmail, booking.guestName, new Date()));
    assert.equal(mails, 0);
  }
});

test('definitive SMTP transaction rejection releases a reminder for correction', async () => {
  for (const failure of [{ command: 'RCPT TO' }, { responseCode: 550 }, { code: 'EDNS' }]) {
    const load = loader({ mail: async () => { throw Object.assign(new Error('Synthetic rejection'), failure); } });
    const result = await load('lib/email-config.ts').sendDocumentRequestEmail(token, booking.guestEmail, booking.guestName, new Date());
    assert.equal(result.success, false); assert.equal(result.uncertain, false);
  }
});

test('authorized empty cron run succeeds and equal-length wrong secrets stay unauthorized', async () => {
  let requests = 0;
  const load = loader({ env: { CRON_SECRET: 'synthetic' }, fetch: async () => { requests++; return json([]); } });
  const route = load('app/api/cron/document-reminders/route.ts');
  assert.equal((await route.GET(new Request('https://local.invalid/api/cron/document-reminders', { headers: { authorization: 'Bearer synthetix' } }))).status, 401);
  const response = await route.POST(new Request('https://local.invalid/api/cron/document-reminders', { headers: { authorization: 'Bearer synthetic' } }));
  assert.equal(response.status, 200); assert.equal((await response.json()).success, true); assert.equal(requests, 1);
});

test('guest upload receipt supplies a safe success message and never displays non-string errors', async () => {
  assert.equal(await loader({ fetch: async () => json({ success: true, wordpressStorage: true }) })('lib/submit-documents.ts').submitDocuments(new FormData()), 'Your documents have been saved.');
  for (const error of ['', {}, null]) {
    await assert.rejects(loader({ fetch: async () => json({ success: false, error }, 500) })('lib/submit-documents.ts').submitDocuments(new FormData()), /contact Villa Claudia before uploading again/);
  }
});


test('default, expired and malformed exceptions reject before consuming any upload body', async () => {
  for (const copyException of [undefined, { ...booking.copyException, active: false }, { ...booking.copyException, expiresAt: null }, { ...booking.copyException, expiresAt: '2020-01-01T00:00:00Z' }, { ...booking.copyException, expiresAt: 'tomorrow' }, { ...booking.copyException, reason: ' ' }, { ...booking.copyException, travelerName: '' }, { ...booking.copyException, caseId: '' }]) {
    let read = false, calls = 0;
    const load = loader({ fetch: async () => { calls++; return json({ ...booking, copyException }); } });
    const request = { headers: new Headers(uploadHeaders), get body() { read = true; throw new Error('Must not read private body'); } };
    const response = await load('app/api/upload/route.ts').POST(request);
    assert.equal(response.status, 403); assert.equal(read, false); assert.equal(calls, 1);
  }
});

test('missing agreement and stale case headers reject before reading multipart', async () => {
  for (const patch of [{ 'x-copy-agreement': 'false' }, { 'x-copy-agreement': '' }, { 'x-copy-case-id': 'previous-case' }]) {
    let read = false;
    const load = loader({ fetch: async () => json(booking) });
    const request = { headers: new Headers({ ...uploadHeaders, ...patch }), get body() { read = true; throw new Error('Must not read private body'); } };
    assert.equal((await load('app/api/upload/route.ts').POST(request)).status, 403); assert.equal(read, false);
  }
});

test('already stored copy rejects duplicate submission before consuming the upload body', async () => {
  let read = false;
  const load = loader({ fetch: async () => json({ ...booking, copyException: { ...booking.copyException, hasCopies: true } }) });
  const request = { headers: new Headers(uploadHeaders), get body() { read = true; throw new Error('Must not read duplicate copy'); } };
  const response = await load('app/api/upload/route.ts').POST(request);
  assert.equal(response.status, 409); assert.equal(read, false); assert.match((await response.json()).error, /already saved/);
});

test('multipart agreement, case, token and adult name must match canonical authorization', async () => {
  for (const [field, value] of [['copyAgreement', 'false'], ['copyCaseId', 'previous-case'], ['bookingId', 'vc_' + 'b'.repeat(64)], ['fileMetadata[0]', JSON.stringify({ travelerName: 'Another adult', documentType: 'passport', documentNumber: 'TEST' })]]) {
    let uploads = 0;
    const load = loader({ fetch: async url => { if (url.includes('secure-booking')) return json(booking); uploads++; } });
    const form = await uploadRequest().formData(); form.set(field, value);
    assert.equal((await load('app/api/upload/route.ts').POST(new Request('https://local.invalid/api/upload', { method: 'POST', body: form, headers: uploadHeaders }))).status, field === 'fileMetadata[0]' ? 400 : 403);
    assert.equal(uploads, 0);
  }
});

test('default private page gives arrival guidance without any upload component', async () => {
  const page = await loader({ fetch: async () => json({ ...booking, copyException: undefined }) })('app/uploads/[secureBookingId]/page.tsx').default({ params: Promise.resolve({ secureBookingId: token }) });
  const text = JSON.stringify(page);
  assert.match(text, /No advance identity-document copy is required/); assert.match(text, /original identity document/); assert.doesNotMatch(text, /DocumentUploadForm/);
});

test('upload forwards the exact optional agreement and case to independently enforced WordPress storage', async () => {
  let forwarded;
  const load = loader({ fetch: async (url, init) => { if (url.includes('secure-booking')) return json(booking); forwarded = init.body; return json({ success: true, storedCount: 1, bookingId: 42 }); } });
  assert.equal((await load('app/api/upload/route.ts').POST(uploadRequest())).status, 201);
  assert.equal(forwarded.get('copyAgreement'), 'true'); assert.equal(forwarded.get('copyCaseId'), 'synthetic-case');
});

test('withdrawal validates canonical case, forwards only its token and confirms deletion receipt', async () => {
  let forwarded;
  const load = loader({ fetch: async (url, init) => { if (url.includes('secure-booking')) return json({ ...booking, copyException: { ...booking.copyException, active: false, expiresAt: '2020-01-01T00:00:00Z', hasCopies: true } }); forwarded = JSON.parse(init.body); return json({ success: true, withdrawn: true, deletedCount: 1 }); } });
  const response = await load('app/api/copy-exception/withdraw/route.ts').POST(new Request('https://local.invalid/api/copy-exception/withdraw', { method: 'POST', headers: uploadHeaders }));
  assert.equal(response.status, 200); assert.equal((await response.json()).deletedCount, 1); assert.deepEqual(forwarded, { uploadToken: token, copyCaseId: 'synthetic-case' }); assert.match(response.headers.get('cache-control'), /no-store/);
});

test('withdrawal rejects stale cases and malformed deletion acknowledgements', async () => {
  for (const receipt of [null, { success: true, withdrawn: false, deletedCount: 0 }, { success: true, withdrawn: true, deletedCount: -1 }, { success: true, withdrawn: true, deletedCount: 1.5 }]) {
    const load = loader({ fetch: async url => url.includes('secure-booking') ? json(booking) : json(receipt) });
    const response = await load('app/api/copy-exception/withdraw/route.ts').POST(new Request('https://local.invalid/withdraw', { method: 'POST', headers: uploadHeaders }));
    assert.equal(response.status, 502); assert.match((await response.json()).error, /Withdrawal was not confirmed/);
  }
  let calls = 0;
  const load = loader({ fetch: async () => { calls++; return json(booking); } });
  assert.equal((await load('app/api/copy-exception/withdraw/route.ts').POST(new Request('https://local.invalid/withdraw', { method: 'POST', headers: { ...uploadHeaders, 'x-copy-case-id': 'stale' } }))).status, 403); assert.equal(calls, 1);
});

test('reminder mail describes arrival registration, voluntary exception and both privacy languages', async () => {
  let sent;
  const load = loader({ mail: async data => { sent = data; return { accepted: [booking.guestEmail] }; } });
  await load('lib/email-config.ts').sendDocumentRequestEmail(token, booking.guestEmail, booking.guestName, new Date());
  assert.match(sent.text, /No advance identity-document copy is required/); assert.match(sent.text, /original identity document/);
  assert.match(sent.text, /https:\/\/documents.invalid\/privacy\n/); assert.match(sent.text, /https:\/\/documents.invalid\/privacy\/de/);
  assert.doesNotMatch(sent.text, /upload documents for all travelers/); assert.equal(sent.attachments, undefined);
});
