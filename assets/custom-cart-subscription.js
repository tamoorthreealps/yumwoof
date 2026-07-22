/**
 * Yumwoof cart drawer enhancements.
 * Built on the theme's native cart-drawer.js / cart.js (open/close + Sections API).
 * Adds:
 *   - Subscription toggle (one-time <-> subscribe) and frequency change via native selling plans.
 *   - "Add more, save more" recommendation loading (Shopify Search & Discovery).
 *   - ADD-to-cart on recommendation cards, and carousel arrows.
 * All mutations re-render the whole drawer inner + cart bubble.
 */
(function () {
  function sectionId() {
    var el = document.getElementById('CartDrawer-SectionId');
    return (el && el.dataset.sectionId) || 'cart-drawer';
  }

  function post(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
    });
  }

  // Re-render the drawer inner (items, rewards, banner, recommendations, footer) + cart bubble.
  // Coalesce concurrent calls so Dawn's own render + our cart:update hook don't double-fetch.
  var _refreshPromise = null;
  function refreshDrawer() {
    if (_refreshPromise) return _refreshPromise;
    _refreshPromise = doRefreshDrawer();
    var clear = function () {
      _refreshPromise = null;
    };
    _refreshPromise.then(clear, clear);
    return _refreshPromise;
  }
  async function doRefreshDrawer() {
    // Fetch a FULL-PAGE render (not ?section_id) so the drawer resolves the
    // section's SAVED settings — membership banner product/images, reward
    // thresholds, title, etc. The cart drawer is inside a section group, whose
    // isolated section render falls back to SCHEMA DEFAULTS and drops those.
    var res = await fetch(window.location.pathname + window.location.search, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!res.ok) throw new Error('drawer page fetch failed');
    var doc = new DOMParser().parseFromString(await res.text(), 'text/html');

    var newInner = doc.querySelector('#CartDrawer .drawer__inner');
    var curInner = document.querySelector('#CartDrawer .drawer__inner');
    if (newInner && curInner) {
      curInner.className = newInner.className;
      curInner.innerHTML = newInner.innerHTML;
      var drawer = document.querySelector('cart-drawer');
      if (drawer) drawer.classList.toggle('is-empty', newInner.classList.contains('is-empty'));
    }

    // Cart icon bubble is in the same full-page response — no extra fetch needed.
    var newBubble = doc.querySelector('#cart-icon-bubble');
    var curBubble = document.getElementById('cart-icon-bubble');
    if (newBubble && curBubble) curBubble.innerHTML = newBubble.innerHTML;
  }

  // Remove a line, then re-add the variant with (or without) a selling plan.
  async function removeAndAdd(lineIndex, variantId, quantity, sellingPlanId) {
    var removeRes = await post('/cart/change.js', { line: lineIndex, quantity: 0 });
    if (!removeRes.ok) throw new Error('remove failed');

    var addBody = { id: variantId, quantity: quantity };
    if (sellingPlanId) addBody.selling_plan = sellingPlanId;
    var addRes = await post('/cart/add.js', addBody);
    if (!addRes.ok) throw new Error('add failed');

    await refreshDrawer();
  }

  /* ---------- Subscription toggle (one-time <-> subscribe) ---------- */
  class CartSubscriptionToggle extends HTMLElement {
    connectedCallback() {
      this._btn = this.querySelector('.cd-toggle__switch');
      if (this._btn && !this._btn.dataset.bound) {
        this._btn.dataset.bound = '1';
        this._btn.addEventListener('click', this._onToggle.bind(this));
      }
    }
    async _onToggle() {
      if (this.classList.contains('cd-busy')) return;
      this.classList.add('cd-busy');
      var line = parseInt(this.dataset.lineIndex, 10);
      var variant = parseInt(this.dataset.variantId, 10);
      var qty = parseInt(this.dataset.quantity, 10) || 1;
      var turningOn = !this.classList.contains('is-on');
      var plan = turningOn ? parseInt(this.dataset.planId, 10) : null;
      try {
        await removeAndAdd(line, variant, qty, plan || null);
      } catch (e) {
        console.error('[cart] subscription toggle failed:', e);
        this.classList.remove('cd-busy');
      }
    }
  }

  /* ---------- Frequency / plan selector ---------- */
  class CartSubscriptionSelector extends HTMLElement {
    connectedCallback() {
      this._select = this.querySelector('select');
      if (this._select && !this._select.dataset.bound) {
        this._select.dataset.bound = '1';
        this._select.addEventListener('change', this._onChange.bind(this));
      }
    }
    async _onChange(event) {
      var line = parseInt(this.dataset.lineIndex, 10);
      var variant = parseInt(this.dataset.variantId, 10);
      var qty = parseInt(this.dataset.quantity, 10) || 1;
      var plan = parseInt(event.target.value, 10);
      this._select.disabled = true;
      try {
        await removeAndAdd(line, variant, qty, plan);
      } catch (e) {
        console.error('[cart] frequency change failed:', e);
        this._select.disabled = false;
      }
    }
  }

  /* ---------- Recommendations loader ---------- */
  class CartRecommendations extends HTMLElement {
    connectedCallback() {
      if (this.dataset.loaded) return;
      var url = this.dataset.url;
      var productId = this.dataset.productId;
      var track = this.querySelector('[data-cd-track]');
      if (!url || !productId || !track) return;
      this.dataset.loaded = '1';

      fetch(url + '&product_id=' + encodeURIComponent(productId))
        .then(function (r) {
          return r.text();
        })
        .then(function (html) {
          var parsed = new DOMParser().parseFromString(html, 'text/html');
          var cards = parsed.querySelectorAll('.cd-rec-card');
          if (cards.length === 0) {
            this.hidden = true;
            return;
          }
          track.innerHTML = '';

          cards.forEach(function (card) {
            const slide = document.createElement('li');
            slide.className = 'splide__slide';
            slide.appendChild(card);
            track.appendChild(slide);
          });
          initRecommendSlider();
        }.bind(this))
        .catch(
          function () {
            this.hidden = true;
          }.bind(this)
        );
    }
  }

  if (!customElements.get('cart-subscription-toggle')) {
    customElements.define('cart-subscription-toggle', CartSubscriptionToggle);
  }
  if (!customElements.get('cart-subscription-selector')) {
    customElements.define('cart-subscription-selector', CartSubscriptionSelector);
  }
  if (!customElements.get('cart-recommendations')) {
    customElements.define('cart-recommendations', CartRecommendations);
  }

  /* ---------- Make the Dawn add-to-cart drawer render use the full page ----------
     Dawn's <cart-drawer>.renderContents() rebuilds the drawer from an isolated
     section render (schema defaults), which drops the membership banner + saved
     settings. Override it to full-page refresh so the banner/thresholds are correct
     whenever the drawer opens on add-to-cart. */
  function overrideDrawerRender() {
    if (!window.customElements) return;
    var CD = customElements.get('cart-drawer');
    if (!CD || CD.prototype.__ywFullPageRender) return;
    CD.prototype.__ywFullPageRender = true;
    CD.prototype.renderContents = function (parsedState) {
      if (parsedState && parsedState.id != null) this.productId = parsedState.id;
      var self = this;
      refreshDrawer()
        .then(function () {
          setTimeout(function () {
            var overlay = self.querySelector('#CartDrawer-Overlay');
            if (overlay) overlay.addEventListener('click', self.close.bind(self));
            self.open();
          });
        })
        .catch(function (e) {
          console.error('[cart] drawer render failed:', e);
        });
    };
  }
  overrideDrawerRender();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', overrideDrawerRender);
  }

  /* ---------- Keep banner + thresholds correct after Dawn cart mutations ----------
     Dawn's quantity/remove path (cart.js) replaces the whole .drawer__inner from an
     isolated section render (schema defaults), dropping the membership banner and
     resetting the reward tiers. After any cart:update, re-render from the full page
     (coalesced with any in-flight render, so no double fetch). */
  if (
    typeof subscribe === 'function' &&
    typeof PUB_SUB_EVENTS !== 'undefined' &&
    PUB_SUB_EVENTS.cartUpdate
  ) {
    subscribe(PUB_SUB_EVENTS.cartUpdate, function () {
      refreshDrawer().catch(function () {});
    });
  }

  /* ---------- Delegated: ADD buttons + carousel arrows ---------- */
  async function addRecommended(btn) {
    if (btn.classList.contains('cd-busy')) return;
    btn.classList.add('cd-busy');
    var variant = parseInt(btn.dataset.variantId, 10);
    var body = { id: variant, quantity: 1 };
    // Subscription/membership products require a selling plan; include it when present.
    var plan = parseInt(btn.dataset.sellingPlan, 10);
    if (plan) body.selling_plan = plan;
    try {
      var res = await post('/cart/add.js', body);
      if (!res.ok) {
        var err = await res.json().catch(function () {
          return {};
        });
        throw new Error(err.description || err.message || 'add failed (' + res.status + ')');
      }
      await refreshDrawer();
    } catch (e) {
      console.error('[cart] add to cart failed:', e);
      btn.classList.remove('cd-busy');
    }
  }

  function handleArrow(arrow) {
    var container = arrow.closest('[data-cd-carousel]') || arrow.closest('.cd-recommend');
    if (!container) return;
    var track = container.querySelector('[data-cd-track]');
    if (!track) return;
    var dir = arrow.hasAttribute('data-cd-next') ? 1 : -1;
    var card = track.firstElementChild;
    var amount = card ? card.getBoundingClientRect().width + 16 : 240;
    track.scrollBy({ left: dir * amount, behavior: 'smooth' });
  }

  document.addEventListener('click', function (event) {
    var addBtn = event.target.closest('[data-cd-add]');
    if (addBtn) {
      event.preventDefault();
      addRecommended(addBtn);
      return;
    }
    var arrow = event.target.closest('.cd-carousel__arrow');
    if (arrow) {
      event.preventDefault();
      handleArrow(arrow);
    }
  });
})();
