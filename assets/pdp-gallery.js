/**
 * Yumwoof PDP gallery.
 * On desktop the gallery shows one image at a time in a square card (see
 * css--pdp-custom.css). Dawn's slider-component blocks native scrolling on desktop,
 * so the prev/next arrows switch the active image via the gallery's own
 * setActiveMedia() (which toggles .is-active), and this keeps the counter in sync.
 */
(function () {
  function initGallery(gallery) {
    if (!gallery || gallery.dataset.ywGallery) return;
    var list = gallery.querySelector('.product__media-list');
    if (!list) return;
    gallery.dataset.ywGallery = '1';

    var prev = gallery.querySelector('.slider-button--prev');
    var next = gallery.querySelector('.slider-button--next');
    var current = gallery.querySelector('.slider-counter--current');

    function items() {
      return Array.prototype.slice.call(gallery.querySelectorAll('.product__media-item'));
    }
    function activeIndex() {
      var its = items();
      for (var i = 0; i < its.length; i++) {
        if (its[i].classList.contains('is-active')) return i;
      }
      return 0;
    }
    function go(i) {
      var its = items();
      i = Math.max(0, Math.min(its.length - 1, i));
      var target = its[i];
      if (!target) return;
      if (typeof gallery.setActiveMedia === 'function') {
        gallery.setActiveMedia(target.dataset.mediaId, false);
      } else {
        its.forEach(function (it) {
          it.classList.remove('is-active');
        });
        target.classList.add('is-active');
      }
      update();
    }
    function update() {
      var i = activeIndex();
      var n = items().length;
      if (current) current.textContent = i + 1;
      if (prev) prev.disabled = i <= 0;
      if (next) next.disabled = i >= n - 1;
    }

    if (prev) {
      prev.addEventListener('click', function (e) {
        e.preventDefault();
        go(activeIndex() - 1);
      });
    }
    if (next) {
      next.addEventListener('click', function (e) {
        e.preventDefault();
        go(activeIndex() + 1);
      });
    }

    // A variant change can switch the active image — keep the counter in sync.
    if (window.MutationObserver) {
      new MutationObserver(update).observe(list, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
      });
    }
    update();
  }

  function initAll(root) {
    (root || document).querySelectorAll('.pdp-gallery media-gallery').forEach(initGallery);
  }

  if (document.readyState !== 'loading') {
    initAll();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      initAll();
    });
  }
  document.addEventListener('shopify:section:load', function (e) {
    initAll(e.target);
  });
})();
