/*
  Variant-level per-market OOS + Klaviyo notify controller.

  Reads the per-variant state map rendered by snippets/buy-buttons.liquid and, on
  each variant change (Dawn's PUB_SUB_EVENTS.variantChange), toggles:
    - the "sold out" body class that hides quantity + subscription for OOS variants
      (the submit button itself is already flipped to "Sold out" by product-info.js),
    - the Klaviyo notify form's visibility.
  It also stamps Klaviyo form submissions with the current variant / market / page so
  each signup is attributable.
*/
(function () {
  var mapEl = document.querySelector('[data-variant-oos-map]');
  if (!mapEl) return;

  var map = {};
  try {
    map = JSON.parse(mapEl.textContent) || {};
  } catch (e) {
    map = {};
  }

  var sectionId = mapEl.getAttribute('data-section-id');
  var productTitle = mapEl.getAttribute('data-product-title') || '';
  var market = mapEl.getAttribute('data-market') || '';
  var productInfo = document.getElementById('MainProduct-' + sectionId);
  var notifyEl = document.querySelector('[data-variant-notify][data-section-id="' + sectionId + '"]');
  var current = null;

  function currentVariantId() {
    var input =
      document.querySelector('#product-form-' + sectionId + ' input[name="id"]') ||
      (productInfo && productInfo.querySelector('input[name="id"].product-variant-id')) ||
      document.querySelector('input.product-variant-id');
    return input && input.value ? String(input.value) : null;
  }

  function apply(vid) {
    if (!vid) vid = currentVariantId();
    if (!vid) return;
    current = vid;
    var state = map[vid] || {};

    // Hide qty + subscription for OOS variants (button handled by product-info.js).
    if (productInfo) productInfo.classList.toggle('pdp--variant-oos', !!state.oos);

    // Show the notify form only when this variant is OOS AND flagged for notify.
    if (notifyEl) {
      var show = !!(state.oos && state.notify);
      notifyEl.hidden = !show;
      notifyEl.setAttribute('data-variant-id', vid);
      notifyEl.setAttribute('data-variant-title', state.title || '');
    }
  }

  apply(currentVariantId());

  if (
    typeof subscribe === 'function' &&
    typeof PUB_SUB_EVENTS !== 'undefined' &&
    PUB_SUB_EVENTS.variantChange
  ) {
    subscribe(PUB_SUB_EVENTS.variantChange, function (event) {
      var v = event && event.data && event.data.variant;
      apply(v ? String(v.id) : null);
    });
  }

  // Tag Klaviyo submissions with the variant / market / page they came from.
  window.addEventListener('klaviyo:forms:submit', function () {
    try {
      var vid = notifyEl ? notifyEl.getAttribute('data-variant-id') : current;
      if (!vid) return;
      var state = map[vid] || {};
      if (window.klaviyo && typeof window.klaviyo.push === 'function') {
        window.klaviyo.push([
          'track',
          'Back in Stock Requested',
          {
            ProductTitle: productTitle,
            VariantID: vid,
            VariantTitle: state.title || '',
            Market: market,
            SourceURL: window.location.href,
          },
        ]);
      }
    } catch (e) {}
  });
})();
