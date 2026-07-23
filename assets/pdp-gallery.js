/**
 * Yumwoof PDP gallery.
 * On desktop the gallery shows one image at a time in a square card (see
 * css--pdp-custom.css: images are stacked, only .is-active is visible).
 *
 * Dawn's slider-component blocks native scroll on desktop and mis-computes its
 * counter in the stacked layout (NaN), and its button handler reverts the image.
 * So we hide Dawn's slider-buttons and render our own counter + arrows, which
 * switch the image via the gallery's own setActiveMedia() (verified to work).
 */
(function () {
  function initGallery(gallery) {
    if (!gallery || gallery.dataset.ywGallery) return;
    var mediaItems = gallery.querySelectorAll('.product__media-item');
    if (mediaItems.length === 0) return;
    gallery.dataset.ywGallery = '1';

    var nav = document.createElement('div');
    nav.className = 'yw-gallery-nav';
    nav.innerHTML =
      '<span class="yw-gallery-counter"><span class="yw-gallery-current">1</span> / <span class="yw-gallery-total"></span></span>' +
      '<button type="button" class="yw-gallery-btn yw-gallery-prev" aria-label="Previous image">&#8592;</button>' +
      '<button type="button" class="yw-gallery-btn yw-gallery-next" aria-label="Next image">&#8594;</button>';
    gallery.appendChild(nav);

    var current = nav.querySelector('.yw-gallery-current');
    var total = nav.querySelector('.yw-gallery-total');
    var prev = nav.querySelector('.yw-gallery-prev');
    var next = nav.querySelector('.yw-gallery-next');

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
      // Toggle .is-active directly. NOT gallery.setActiveMedia() — that calls
      // resetPages() which fires a debounced slideChanged that reverts the image
      // back to the scroll position (always 0 in this stacked layout).
      its.forEach(function (it) {
        it.classList.remove('is-active');
      });
      target.classList.add('is-active');
      update();
    }
    function update() {
      var i = activeIndex();
      var n = items().length;
      current.textContent = i + 1;
      total.textContent = n;
      prev.disabled = i <= 0;
      next.disabled = i >= n - 1;
      nav.style.display = n > 1 ? '' : 'none';
    }

    prev.addEventListener('click', function (e) {
      e.preventDefault();
      go(activeIndex() - 1);
    });
    next.addEventListener('click', function (e) {
      e.preventDefault();
      go(activeIndex() + 1);
    });

    // A variant change can switch the active image — keep the counter in sync.
    if (window.MutationObserver) {
      new MutationObserver(update).observe(gallery, {
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
