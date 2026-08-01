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
    '<div class="yw-gallery-pagination"></div>' +
    '<button type="button" class="yw-gallery-btn yw-gallery-prev" aria-label="Previous image">&#8592;</button>' +
    '<button type="button" class="yw-gallery-btn yw-gallery-next" aria-label="Next image"><svg width="20" height="10" viewBox="0 0 20 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5432 10C12.9023 9.17355 13.2751 8.44353 13.6617 7.80992C14.0484 7.14876 14.435 6.58402 14.8217 6.1157H0V3.8843H14.8217C14.435 3.38843 14.0484 2.82369 13.6617 2.19008C13.2751 1.52893 12.9023 0.798898 12.5432 0H14.4903C16.2302 2.01102 18.0668 3.49862 20 4.46281V5.53719C18.0668 6.47383 16.2302 7.96143 14.4903 10H12.5432Z" fill="#FFF9EF"/></svg></button>';
    gallery.appendChild(nav);
    var pagination = nav.querySelector('.yw-gallery-pagination');
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
    function buildPagination() {
      pagination.innerHTML = '';

      items().forEach(function (_, index) {
        var bullet = document.createElement('button');
        bullet.type = 'button';
        bullet.className = 'yw-gallery-bullet';

        bullet.addEventListener('click', function () {
          go(index);
        });

        pagination.appendChild(bullet);
      });
    }
    function update() {
      var i = activeIndex();
      var n = items().length;
      current.textContent = i + 1;
      total.textContent = n;
      prev.disabled = i <= 0;
      next.disabled = i >= n - 1;
      nav.style.display = n > 1 ? '' : 'none';

      pagination.querySelectorAll('.yw-gallery-bullet').forEach(function (bullet, index) {
        bullet.classList.toggle('is-active', index === i);
      });
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
    buildPagination();
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
