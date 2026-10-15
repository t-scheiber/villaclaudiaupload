/* eslint-disable @typescript-eslint/no-require-imports -- Node's isolated test runner executes this fixture as CommonJS. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../villa-claudia-privacy/assets/checkout-complete.js'), 'utf8');

test('paid-receipt cleanup removes exact Woo checkout caches and preserves unrelated browser state', () => {
  const values = new Map([
    ['storeApiCartData', 'synthetic address'], ['storeApiCartHash', 'synthetic hash'], ['storeApiNonce', 'synthetic nonce'],
    ['__stripe_mid', 'payment state'], ['unrelated', 'keep'], ['wc_cart_hash_example', 'keep native cart'],
  ]);
  const events = {}; let subscriber;
  const window = {
    localStorage: { removeItem: key => values.delete(key) },
    wp: { data: { subscribe: listener => { subscriber = listener; } } },
    addEventListener: (name, listener) => { events[name] = listener; },
  };
  vm.runInNewContext(script, { window });
  assert.deepEqual([...values.keys()], ['__stripe_mid', 'unrelated', 'wc_cart_hash_example']);
  values.set('storeApiCartData', 'late response'); subscriber();
  assert.equal(values.has('storeApiCartData'), false);
  values.set('storeApiCartData', 'later response'); events.pagehide();
  assert.equal(values.has('storeApiCartData'), false);
});

test('receipt cleanup tolerates storage restrictions and absent optional data subscription', () => {
  const events = {};
  const window = { localStorage: { removeItem() { throw new Error('blocked'); } }, addEventListener: (name, listener) => { events[name] = listener; } };
  assert.doesNotThrow(() => vm.runInNewContext(script, { window }));
  assert.doesNotThrow(() => events.pagehide());
});
