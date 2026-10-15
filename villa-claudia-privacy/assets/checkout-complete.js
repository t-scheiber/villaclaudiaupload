(function () {
  'use strict';
  // Woo Blocks caches the cart response, including entered address fields.
  // PHP loads this file only for an authenticated, paid order receipt.
  function clearCompletedCheckout() {
    try {
      ['storeApiCartData', 'storeApiCartHash', 'storeApiNonce'].forEach(function (key) {
        window.localStorage.removeItem(key);
      });
    } catch {
      // A browser that blocks storage must still show its payment receipt.
    }
  }
  clearCompletedCheckout();
  if (window.wp && window.wp.data && typeof window.wp.data.subscribe === 'function') {
    // Clear again after late Woo Store API updates on the receipt page.
    window.wp.data.subscribe(clearCompletedCheckout);
  }
  window.addEventListener('pagehide', clearCompletedCheckout);
}());
