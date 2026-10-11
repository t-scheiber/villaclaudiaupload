/* eslint-disable @typescript-eslint/no-require-imports -- isolated CommonJS test loader */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const token = 'vc_' + 'a'.repeat(64);
const booking = { bookingId: 42, guestName: 'Synthetic Guest', guestEmail: 'guest@example.invalid', checkInDate: '2026-09-29', checkOutDate: '2026-10-06', status: 'confirmed' };
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
function uploadRequest(id = token, count = 1, documentNumber = 'NOT-AN-ID') {
  const form = new FormData(); form.set('bookingId', id);
  form.set('guestName', 'Attacker-chosen name'); form.set('email', 'different@example.invalid');
  for (let i = 0; i < count; i++) {
    form.append('files', new File(['%PDF-1.4\nsynthetic fixture'], 'same-name.pdf', { type: 'application/pdf' }));
    form.set(`fileMetadata[${i}]`, JSON.stringify({ travelerName: 'Synthetic Guest', documentType: 'passport', documentNumber }));
  }
  return new Request('https://local.invalid/api/upload', { method: 'POST', body: form });
}
test('national ID selection includes EU, EEA and Swiss guests without allowing unrelated citizenships', () => {
  const { acceptsNationalId } = loader()('components/document-upload-form.tsx');
  for (const country of ['at', 'de', 'hr', 'no', 'is', 'li', 'ch']) assert.equal(acceptsNationalId(country), true);
  for (const country of ['gb', 'us', 'other', '']) assert.equal(acceptsNationalId(country), false);
});
test('numeric, malformed, uppercase and encoded tokens are rejected before backend access', async () => {
  let calls = 0;
  const load = loader({ fetch: async () => { calls++; return json(booking); } });
  for (const bad of ['420000000000000000', token.toUpperCase(), token + '\n', 'vc_%61' + 'a'.repeat(63), '../42', '']) {
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
  assert.equal(result.notificationSent, true); assert.match(sent.data.text, /guest@example.invalid/); assert.doesNotMatch(sent.data.text, /different@example.invalid/);
  assert.equal(sent.config.tls.rejectUnauthorized, true); assert.equal(sent.config.requireTLS, true); assert.equal(sent.config.debug, false);
});
test('admin notifications keep duplicate original filenames separate and align them with guest details', async () => {
  let sent;
  const load = loader({ fetch: async url => url.includes('secure-booking') ? json(booking) : json({ success: true, storedCount: 2, bookingId: 42 }),
    mail: async data => { sent = data; return { accepted: ['admin@example.invalid'] }; } });
  assert.equal((await load('app/api/upload/route.ts').POST(uploadRequest(token, 2))).status, 201);
  assert.equal(sent.attachments[0].filename, '1-same-name.pdf');
  assert.equal(sent.attachments[1].filename, '2-same-name.pdf');
  assert.match(sent.text, /1\. Synthetic Guest/); assert.match(sent.text, /2\. Synthetic Guest/);
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
  const request = new Request('https://local.invalid/api/upload', { method: 'POST', body: 'small', headers: { 'Content-Length': String(28 * 1024 * 1024) } });
  assert.equal((await load('app/api/upload/route.ts').POST(request)).status, 413);
  assert.equal((await load('app/api/upload/route.ts').POST(uploadRequest(token, 9))).status, 400);
});
test('empty and whitespace-only document numbers fail before storage or notification', async () => {
  let uploads = 0, mails = 0;
  const load = loader({ fetch: async url => {
    if (url.includes('secure-booking')) return json(booking);
    uploads++; return json({ success: true, storedCount: 1, bookingId: 42 });
  }, mail: async () => { mails++; return { accepted: ['admin@example.invalid'] }; } });
  for (const number of ['', '   ', '\t\n']) {
    assert.equal((await load('app/api/upload/route.ts').POST(uploadRequest(token, 1, number))).status, 400);
  }
  assert.equal(uploads, 0); assert.equal(mails, 0);
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
