/*
 * Nutrition label drawer (PDP)
 * ---------------------------------------------------------------------------
 * <nutrition-label> wraps the "Know what you're feeding" buttons + the drawer.
 * Buttons open the drawer on a given tab; the drawer shows the SELECTED
 * variant's data for per-variant tabs (ingredients/analysis/calories/full) and
 * shared data for feeding/transition.
 *
 * The Feeding tab is computed from the same feeding_table bands + the shopper's
 * saved dog (localStorage) that the quantity calculator uses.
 */
(function () {
  var SHARED = { feeding: 1, transition: 1 };
  var STORE_PREFIX = 'yumwoof_qcalc_p';
  var MAX_AGE = 7 * 24 * 60 * 60 * 1000;

  /* daily cups for a weight, interpolated within the feeding band (matches qcalc) */
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

  function round1(c) { return Math.round(c * 10) / 10; }
  function tableCups(c) { return round1(c).toFixed(1) + ' cups'; }
  function calloutCups(c) { var r = round1(c); return r + ' ' + (r === 1 ? 'cup' : 'cups'); }

  function readDog(pid) {
    try {
      var raw = localStorage.getItem(STORE_PREFIX + pid);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.dogs || !o.dogs.length) return null;
      if (o.ts && Date.now() - o.ts > MAX_AGE) return null;
      var d = o.dogs[0];
      return { name: d.name || 'Your dog', weight: Number(d.weight) || 0, puppy: d.stage === 'puppy' };
    } catch (e) { return null; }
  }

  function nearest(weights, w) {
    var best = weights[0], bd = Infinity;
    weights.forEach(function (x) { var d = Math.abs(x - w); if (d < bd) { bd = d; best = x; } });
    return best;
  }

  class NutritionLabel extends HTMLElement {
    connectedCallback() {
      this.section = this.closest('.shopify-section') || document;
      this.productId = this.dataset.product;
      this.drawer = this.querySelector('[data-nldrawer]');
      if (!this.drawer) return;

      // Move the fixed overlay to <body> so ancestor transforms don't trap it.
      document.body.appendChild(this.drawer);

      this.card = this.drawer.querySelector('.nldrawer__card');
      this.eyebrowEl = this.drawer.querySelector('[data-nldrawer-eyebrow]');
      this.headingEl = this.drawer.querySelector('[data-nldrawer-heading]');
      this.tabs = Array.prototype.slice.call(this.drawer.querySelectorAll('[data-nldrawer-tab]'));
      this.panels = Array.prototype.slice.call(this.drawer.querySelectorAll('[data-nldrawer-panel]'));
      this.variantEls = Array.prototype.slice.call(this.drawer.querySelectorAll('[data-nldrawer-variant]'));
      this.bodyEl = this.drawer.querySelector('[data-nldrawer-body]');
      this.activeTab = null;
      this.lastFocus = null;

      // Open buttons
      this.querySelectorAll('[data-nlabel-open]').forEach(function (btn) {
        btn.addEventListener('click', function () { this.open(btn.dataset.nlabelOpen); }.bind(this));
      }, this);

      // Tab switching
      this.tabs.forEach(function (t) {
        t.addEventListener('click', function () { this.showTab(t.dataset.nldrawerTab); }.bind(this));
      }, this);

      // Close interactions
      this.drawer.querySelectorAll('[data-nldrawer-close]').forEach(function (el) {
        el.addEventListener('click', this.close.bind(this));
      }, this);
      this._onKey = function (e) { if (e.key === 'Escape') this.close(); }.bind(this);

      // Re-render when the shopper changes variant
      this.section.addEventListener('change', function () {
        var id = this.currentVariantId();
        if (id && id !== this._variantId) {
          this._variantId = id;
          if (this.isOpen && this.activeTab && !SHARED[this.activeTab]) this.showTab(this.activeTab);
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

    open(tab) {
      this.lastFocus = document.activeElement;
      this._variantId = this.currentVariantId();
      this.drawer.hidden = false;
      this.isOpen = true;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', this._onKey);
      // next frame so the transition runs
      requestAnimationFrame(function () { this.drawer.classList.add('is-open'); }.bind(this));
      this.showTab(tab);
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

    showTab(tab) {
      this.activeTab = tab;
      this.tabs.forEach(function (b) { b.classList.toggle('is-active', b.dataset.nldrawerTab === tab); });
      this.panels.forEach(function (p) { p.hidden = true; });
      this.variantEls.forEach(function (v) { v.hidden = true; });

      var panel = null;
      if (SHARED[tab]) {
        panel = this.drawer.querySelector('.nldrawer__panel--shared[data-nldrawer-panel="' + tab + '"]');
      } else {
        var vEl = this.variantEl(this._variantId) || this.variantEls[0];
        if (vEl) {
            vEl.hidden = false;
            const headColor = vEl.dataset.headColor;
            if (headColor) {
                this.drawer.style.setProperty('--nutrition-head-color', headColor);
            }
            panel = vEl.querySelector('[data-nldrawer-panel="' + tab + '"]');
        }
      }
      if (panel) {
        panel.hidden = false;
        this.eyebrowEl.textContent = panel.getAttribute('data-eyebrow') || '';
        this.headingEl.textContent = panel.getAttribute('data-title') || '';
        if (tab === 'feeding') this.renderFeeding(panel);
      }
      if (this.bodyEl) this.bodyEl.scrollTop = 0;
    }

    renderFeeding(panel) {
      var cfgEl = panel.querySelector('[data-nldrawer-feeding-config]');
      var rowsEl = panel.querySelector('[data-nldrawer-feeding-rows]');
      if (!cfgEl || !rowsEl) return;
      var cfg;
      try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }
      var bands = (cfg.bands || []).map(function (b) {
        return { minW: +b.minW, maxW: +b.maxW, minC: +b.minC, maxC: +b.maxC };
      });
      var gpc = cfg.gramsPerCup || 160;
      var dog = readDog(cfg.productId);
      var match = dog ? nearest(cfg.weights, dog.weight) : null;

      rowsEl.innerHTML = cfg.weights.map(function (w) {
        var cups = cupsPerDay(w, bands);
        var grams = Math.round(cups * gpc);
        return '<tr class="' + (w === match ? 'is-match' : '') + '">' +
          '<td>' + w + ' lbs</td>' +
          '<td class="nldrawer__ta-r">' + tableCups(cups) + '</td>' +
          '<td class="nldrawer__ta-r nldrawer__grams">' + grams + ' g</td>' +
          '</tr>';
      }).join('');

      var callout = panel.querySelector('[data-nldrawer-feeding-callout]');
      var caltitle = panel.querySelector('[data-nldrawer-feeding-caltitle]');
      if (dog && callout && caltitle) {
        var daily = cupsPerDay(dog.weight, bands) * (dog.puppy ? 2 : 1);
        caltitle.textContent = dog.name + ' · ' + calloutCups(daily) + ' a day';
        callout.hidden = false;
      } else if (callout) {
        callout.hidden = true;
      }
    }
  }

  if (!customElements.get('nutrition-label')) {
    customElements.define('nutrition-label', NutritionLabel);
  }
})();
