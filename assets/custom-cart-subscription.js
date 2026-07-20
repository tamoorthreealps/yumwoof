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
  async function refreshDrawer() {
    var res = await fetch('/?section_id=' + encodeURIComponent(sectionId()));
    if (!res.ok) throw new Error('drawer section fetch failed');
    var doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    var newInner = doc.querySelector('.drawer__inner');
    var curInner = document.querySelector('#CartDrawer .drawer__inner');
    if (newInner && curInner) {
      curInner.className = newInner.className;
      curInner.innerHTML = newInner.innerHTML;
      var drawer = document.querySelector('cart-drawer');
      if (drawer) drawer.classList.toggle('is-empty', newInner.classList.contains('is-empty'));
    }

    try {
      var bubbleRes = await fetch('/?section_id=cart-icon-bubble');
      if (bubbleRes.ok) {
        var bdoc = new DOMParser().parseFromString(await bubbleRes.text(), 'text/html');
        var target = document.getElementById('cart-icon-bubble');
        var source = bdoc.querySelector('.shopify-section') || bdoc.body;
        if (target && source) target.innerHTML = source.innerHTML;
      }
    } catch (e) {
      /* non-fatal */
    }
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

  /* ---------- Delegated: ADD buttons + carousel arrows ---------- */
  async function addRecommended(btn) {
    if (btn.classList.contains('cd-busy')) return;
    btn.classList.add('cd-busy');
    var variant = parseInt(btn.dataset.variantId, 10);
    try {
      var res = await post('/cart/add.js', { id: variant, quantity: 1 });
      if (!res.ok) throw new Error('add failed');
      await refreshDrawer();
    } catch (e) {
      console.error('[cart] add recommended failed:', e);
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
