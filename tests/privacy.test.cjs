/* eslint-disable @typescript-eslint/no-require-imports -- isolated server-rendering tests */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const canonical = JSON.parse(fs.readFileSync(path.join(root, 'content/privacy-policy.json'), 'utf8'));
const fixture = { status: 'published', updatedAt: '2026-10-15', languages: {
  en: { title: 'Synthetic privacy policy', html: '<h2>Information</h2><p>Synthetic English policy &amp; contact information.</p>' },
  de: { title: 'Synthetischer Datenschutzhinweis', html: '<h2>Informationen</h2><p>Synthetischer deutscher Hinweis.</p>' },
} };

function loader(policy = canonical) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (file.endsWith('privacy-policy.json')) return policy;
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const resolve = name => {
      if (name.endsWith('.css')) return {};
      if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (name === 'next/image') return { __esModule: true, default: ({ priority, ...props }) => { void priority; return React.createElement('img', props); } };
      if (name === 'next/font/google') return { Inter: () => ({ className: 'synthetic-font' }) };
      if (name === 'next/navigation') return { notFound: () => { throw new Error('NEXT_NOT_FOUND'); } };
      if (name.startsWith('@/') || name.startsWith('.')) {
        let target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
        if (!path.extname(target)) target += fs.existsSync(target + '.ts') ? '.ts' : '.tsx';
        return load(target);
      }
      return require(name);
    };
    vm.runInNewContext(source, { module: mod, exports: mod.exports, require: resolve, Intl, Date, URL, console, process: { env: {} } }, { filename: file });
    return mod.exports;
  }
  return load;
}

test('both privacy routes render the exact canonical HTML in an explicitly tagged language', () => {
  const load = loader(fixture);
  for (const [language, file] of [['en', 'app/privacy/page.tsx'], ['de', 'app/privacy/de/page.tsx']]) {
    const rendered = renderToStaticMarkup(load(file).default());
    assert.ok(rendered.includes(fixture.languages[language].html));
    assert.match(rendered, new RegExp(`id="villa-privacy-policy-${language}"`));
    assert.match(rendered, new RegExp(`<article[^>]*lang="${language}"`));
    assert.match(rendered, /aria-current="page"/);
    assert.match(rendered, /<time dateTime="2026-10-15"/);
  }
});

test('unpublished policy content never renders as a published privacy statement', () => {
  const draft = structuredClone(fixture); draft.status = 'draft';
  const load = loader(draft);
  assert.throws(() => renderToStaticMarkup(load('app/privacy/page.tsx').default()), /NEXT_NOT_FOUND/);
  assert.throws(() => renderToStaticMarkup(load('app/privacy/de/page.tsx').default()), /NEXT_NOT_FOUND/);
});

test('publication schema rejects missing translations, empty published text and invalid dates', () => {
  const { assertPrivacyPolicy } = loader(fixture)('lib/privacy-policy.ts');
  for (const update of [value => { delete value.languages.de; }, value => { value.languages.en.html = ' '; }, value => { value.updatedAt = '2026-02-31'; }, value => { value.status = 'unknown'; }]) {
    const invalid = structuredClone(fixture); update(invalid);
    assert.throws(() => assertPrivacyPolicy(invalid));
  }
});

test('policy schema rejects active HTML and allows static contact links', () => {
  const { assertPrivacyPolicy } = loader(fixture)('lib/privacy-policy.ts');
  for (const html of ['<script>alert(1)</script>', '<p onclick="submit()">Synthetic</p>', '<a href="javascript:alert(1)">Synthetic</a>', '<form><input /></form>']) {
    const invalid = structuredClone(fixture); invalid.languages.en.html = html;
    assert.throws(() => assertPrivacyPolicy(invalid));
  }
  const valid = structuredClone(fixture);
  valid.languages.en.html = '<p>Contact data: <a href="mailto:info@villa-claudia.eu">Email Villa Claudia</a></p>';
  assert.doesNotThrow(() => assertPrivacyPolicy(valid));
});

test('site footer exposes both policy languages on every page', () => {
  const rendered = renderToStaticMarkup(loader(fixture)('app/layout.tsx').default({ children: React.createElement('p', null, 'Synthetic page') }));
  const footer = rendered.slice(rendered.indexOf('<footer'));
  assert.match(footer, /href="\/privacy"[^>]*lang="en"/);
  assert.match(footer, /href="\/privacy\/de"[^>]*lang="de"/);
  assert.doesNotMatch(footer, /securely processed and stored/);
});

test('guest form places both policy links before any document submission', () => {
  const Form = loader(fixture)('components/document-upload-form.tsx').default;
  const rendered = renderToStaticMarkup(React.createElement(Form, { bookingId: 'synthetic', bookingData: { checkInDate: '2026-10-22' }, copyException: { active: true, expiresAt: '2099-10-15T12:00:00Z', caseId: 'synthetic-case', travelerName: 'Synthetic Guest', reason: 'Synthetic reason', hasCopies: false } }));
  assert.ok(rendered.indexOf('href="/privacy"') < rendered.indexOf('<form'));
  assert.match(rendered, /href="\/privacy\/de"[^>]*lang="de"/);
  assert.match(rendered, /name="files"|type="file"/);
});

test('exception form fixes the adult name, has unchecked voluntary agreement and a refusal action', () => {
  const Form = loader(fixture)('components/document-upload-form.tsx').default;
  const rendered = renderToStaticMarkup(React.createElement(Form, { bookingId: 'synthetic', bookingData: {}, copyException: { active: true, expiresAt: '2099-10-15T12:00:00Z', caseId: 'synthetic-case', travelerName: 'Synthetic Adult', reason: 'Synthetic exception reason', hasCopies: false } }));
  assert.match(rendered, /value="Synthetic Adult"[^>]*readOnly=""|readOnly=""[^>]*value="Synthetic Adult"/);
  assert.match(rendered, /type="checkbox"/); assert.doesNotMatch(rendered, /checked=""/);
  assert.match(rendered, /refuse or withdraw without disadvantage/); assert.match(rendered, /I will show the original on arrival instead/);
  assert.match(rendered, /Synthetic exception reason/); assert.doesNotMatch(rendered, /Document number|exception-number/); assert.doesNotMatch(rendered, /Add Another Guest/);
});

test('expired exception with saved copies retains withdrawal without a new upload form', () => {
  const Form = loader(fixture)('components/document-upload-form.tsx').default;
  const rendered = renderToStaticMarkup(React.createElement(Form, { bookingId: 'synthetic', bookingData: {}, copyException: { active: false, expiresAt: '2020-10-15T12:00:00Z', caseId: 'synthetic-case', travelerName: 'Synthetic Adult', reason: 'Synthetic exception reason', hasCopies: true } }));
  assert.match(rendered, /Withdraw agreement and delete my copy/); assert.doesNotMatch(rendered, /<form|type="file"/);
});

test('canonical publication includes complete English and German content', () => {
  assert.equal(canonical.status, 'published', 'Approved policy content must be supplied before release.');
  const { assertPrivacyPolicy } = loader(canonical)('lib/privacy-policy.ts');
  assert.doesNotThrow(() => assertPrivacyPolicy(canonical));
});
