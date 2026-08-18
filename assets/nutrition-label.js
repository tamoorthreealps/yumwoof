/*
 * Nutrition label drawer (PDP) [redesign]
 * ---------------------------------------------------------------------------
 * <nutrition-label> wraps the "Know what you're feeding" buttons + the popup.
 * Each button opens the popup showing ONE table (no in-popup tabs):
 *   analysis / full  -> the SELECTED variant's data
 *   feeding          -> computed from feeding_table bands (cups / kg / grams)
 *   transition       -> shared
 * The header band takes the selected recipe's colour (data-color).
 * The eyebrow always reflects the selected product + variant.
 */
(function () {
  var SHARED = { feeding: 1, transition: 1 };
  var LB_TO_KG = 0.453592;

  function cupsPerDay(weight, bands) {
    if (!bands || !bands.length) return 0;
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      if (weight >= b.minW && weight <= b.maxW) {
        var span = b.maxW - b.minW;
        if (span <= 0) return b.minC;
        return b.minC + ((weight - b.minW) * (b.maxC - b.minC)) / span;
      }
    }
    var last = bands[bands.length - 1];
    return last ? last.maxC : 0;
  }

  class NutritionLabel extends HTMLElement {
    connectedCallback() {
      this.section = this.closest('.shopify-section') || document;
      this.drawer = this.querySelector('[data-nldrawer]');
      if (!this.drawer) return;

      document.body.appendChild(this.drawer); // escape ancestor transforms

      this.card = this.drawer.querySelector('.nldrawer__card');
      this.eyebrowEl = this.drawer.querySelector('[data-nldrawer-eyebrow]');
      this.headingEl = this.drawer.querySelector('[data-nldrawer-heading]');
      this.panels = Array.prototype.slice.call(this.drawer.querySelectorAll('[data-nldrawer-panel]'));
      this.variantEls = Array.prototype.slice.call(this.drawer.querySelectorAll('[data-nldrawer-variant]'));
      this.bodyEl = this.drawer.querySelector('[data-nldrawer-body]');
      this.productTitle = this.drawer.getAttribute('data-product-title') || '';
      this.activePanel = null;
      this.lastFocus = null;

      this.querySelectorAll('[data-nlabel-open]').forEach(function (btn) {
        btn.addEventListener('click', function () { this.open(btn.dataset.nlabelOpen); }.bind(this));
      }, this);

      this.drawer.querySelectorAll('[data-nldrawer-close]').forEach(function (el) {
        el.addEventListener('click', this.close.bind(this));
      }, this);
      this._onKey = function (e) { if (e.key === 'Escape') this.close(); }.bind(this);

      this.section.addEventListener('change', function () {
        var id = this.currentVariantId();
        if (id && id !== this._variantId) {
          this._variantId = id;
          if (this.isOpen && this.activePanel) this.show(this.activePanel);
        }
      }.bind(this));
    }

    currentVariantId() {
      var input = this.section.querySelector('[name="id"]');
      return input ? input.value : null;
    }

    variantEl(id) {
      return this.drawer.querySelector('[data-nldrawer-variant="' + id + '"]');
    }

    activeVariantEl() {
      return this.variantEl(this._variantId) || this.variantEls[0] || null;
    }

    /* "Product Title · Variant Title" — drops the variant when it's absent,
       or when it just repeats the product title (single-variant products
       where Liquid substituted product.title for "Default Title"). */
    sharedEyebrow(vEl) {
      var product = this.productTitle;
      var variant = vEl ? vEl.getAttribute('data-variant-title') || '' : '';
      if (!product) return '';
      return variant && variant !== product ? product + ' · ' + variant : product;
    }

    open(panel) {
      this.lastFocus = document.activeElement;
      this._variantId = this.currentVariantId();
      this.drawer.hidden = false;
      this.isOpen = true;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', this._onKey);
      requestAnimationFrame(function () { this.drawer.classList.add('is-open'); }.bind(this));
      this.show(panel);
      if (this.card) this.card.focus();
    }

    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.drawer.classList.remove('is-open');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', this._onKey);
      var drawer = this.drawer;
      setTimeout(function () { if (!drawer.classList.contains('is-open')) drawer.hidden = true; }, 220);
      if (this.lastFocus && this.lastFocus.focus) this.lastFocus.focus();
    }

    show(panel) {
      this.activePanel = panel;
      this.panels.forEach(function (p) { p.hidden = true; });
      this.variantEls.forEach(function (v) { v.hidden = true; });

      var vEl = this.activeVariantEl();
      var color = vEl ? vEl.getAttribute('data-color') : null;
      var el = null;
      var eyebrow = '';

      if (SHARED[panel]) {
        el = this.drawer.querySelector('.nldrawer__panel--shared[data-nldrawer-panel="' + panel + '"]');
        eyebrow = this.sharedEyebrow(vEl) || (el ? el.getAttribute('data-eyebrow') || '' : '');
      } else if (vEl) {
        vEl.hidden = false;
        el = vEl.querySelector('[data-nldrawer-panel="' + panel + '"]');
        eyebrow = vEl.getAttribute('data-eyebrow') || '';
      }

      if (color && this.card) this.card.style.setProperty('--nl-header', color);
      if (el) {
        el.hidden = false;
        this.headingEl.textContent = el.getAttribute('data-title') || '';
        this.eyebrowEl.textContent = eyebrow;
        if (panel === 'feeding') this.renderFeeding(el);
      }
      if (this.bodyEl) this.bodyEl.scrollTop = 0;
    }

    renderFeeding(panel) {
      var cfgEl = panel.querySelector('[data-nldrawer-feeding-config]');
      var rowsEl = panel.querySelector('[data-nldrawer-feeding-rows]');
      if (!cfgEl || !rowsEl || rowsEl.childElementCount) return; // build once
      var cfg;
      try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }
      var bands = (cfg.bands || []).map(function (b) {
        return { minW: +b.minW, maxW: +b.maxW, minC: +b.minC, maxC: +b.maxC };
      });
      var gpc = cfg.gramsPerCup || 160;

      rowsEl.innerHTML = cfg.weights.map(function (w) {
        var cups = cupsPerDay(w, bands);
        var kg = Math.round(w * LB_TO_KG);
        var grams = Math.round(cups * gpc);
        var cupsDisp = (Math.round(cups * 10) / 10).toFixed(1);
        return '<div class="nldrawer__feed-row">' +
          '<span>' + w + ' lbs (' + kg + 'kg)</span>' +
          '<span class="nldrawer__ta-r">' + cupsDisp + ' cups (' + grams + 'g)</span>' +
          '</div>';
      }).join('');
    }
  }

  if (!customElements.get('nutrition-label')) {
    customElements.define('nutrition-label', NutritionLabel);
  }
})();