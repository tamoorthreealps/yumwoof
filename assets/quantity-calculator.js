/**
 * <quantity-calculator> — PDP order-size quiz.
 *
 * Reads the product's feeding table (rendered as JSON by
 * snippets/quantity-calculator.liquid) and the shopper's saved dogs
 * (localStorage, shared across products) to suggest how many bags of the
 * SELECTED variant to order. A guided 3-step quiz collects each dog's weight,
 * age and name; dogs persist until removed and multiple dogs are summed.
 */
(function () {
  var DOGS_KEY = 'yumwoof_qcalc_dogs';

  /* ---------- shared dog store (localStorage) ---------- */
  function loadDogs() {
    try {
      var raw = localStorage.getItem(DOGS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }
  function saveDogs(dogs) {
    try {
      localStorage.setItem(DOGS_KEY, JSON.stringify(dogs));
    } catch (e) {}
    // let other <quantity-calculator> instances on the page react
    document.dispatchEvent(new CustomEvent('qcalc:dogs-changed'));
  }

  /* ---------- helpers ---------- */
  var STAGES = [
    ['puppy', 'Puppy', 'Under 1 year — servings are doubled'],
    ['adult', 'Adult', '1–7 years'],
    ['senior', 'Senior', '7+ years'],
  ];
  var WEIGHT_PRESETS = [8, 15, 30, 50, 75, 100];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() {
    return 'd' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  }
  function fmtCups(c) {
    var r = Math.round(c * 10) / 10;
    return r + ' ' + (r === 1 ? 'cup' : 'cups');
  }
  function stageLabel(s) {
    return s === 'puppy' ? 'puppy' : s === 'senior' ? 'senior' : 'adult';
  }

  /* daily cups for a weight, interpolated within the feeding band */
  function cupsPerDay(weight, bands) {
    if (!bands || !bands.length) return 0;
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      if (weight <= b.maxW) {
        var span = b.maxW - b.minW;
        if (span <= 0) return b.minC;
        return b.minC + ((weight - b.minW) * (b.maxC - b.minC)) / span;
      }
    }
    var last = bands[bands.length - 1];
    return last ? last.maxC : 0;
  }
  function dailyCups(dog, bands) {
    return cupsPerDay(dog.weight, bands) * (dog.stage === 'puppy' ? 2 : 1);
  }

  /* parse a bag weight in oz from a variant title like "Land & Sea / 7 Pound Bag" */
  function bagOzFromTitle(title) {
    var parts = String(title || '').split('/');
    for (var i = 0; i < parts.length; i++) {
      var m = parts[i].match(/([\d.]+)\s*(lbs?|pounds?|oz|ounces?)/i);
      if (m) {
        var n = parseFloat(m[1]);
        return /^(lb|lbs|pound|pounds)$/i.test(m[2]) ? n * 16 : n;
      }
    }
    // fall back to any weight token in the whole title
    var m2 = String(title || '').match(/([\d.]+)\s*(lbs?|pounds?|oz|ounces?)/i);
    if (m2) {
      var n2 = parseFloat(m2[1]);
      return /^(lb|lbs|pound|pounds)$/i.test(m2[2]) ? n2 * 16 : n2;
    }
    return 0;
  }
  /* the human label for the bag size portion of a variant title */
  function bagLabelFromTitle(title) {
    var parts = String(title || '').split('/');
    for (var i = 0; i < parts.length; i++) {
      if (/([\d.]+)\s*(lbs?|pounds?|oz|ounces?)/i.test(parts[i])) return parts[i].trim();
    }
    return String(title || '').trim();
  }

  class QuantityCalculator extends HTMLElement {
    connectedCallback() {
      if (this._init) return;
      this._init = true;

      var cfgEl = this.querySelector('[data-qcalc-config]');
      try {
        this.cfg = JSON.parse(cfgEl.textContent);
      } catch (e) {
        this.cfg = null;
      }
      if (!this.cfg || !this.cfg.table || !this.cfg.table.bands.length) return;

      this.sectionId = this.getAttribute('data-section');
      this.slotEl = this.querySelector('[data-qcalc-slot]');
      this.scrim = this.querySelector('[data-qz-scrim]');
      this.body = this.querySelector('[data-qz-body]');
      this.dots = this.querySelector('[data-qz-dots]');
      this.backBtn = this.querySelector('[data-qz-back]');
      this.container = this.closest('.shopify-section, section, product-info') || document;

      this.dogs = loadDogs();
      this.draft = null;
      this.editIdx = null;
      this.step = 0;

      // modal chrome
      this.querySelector('[data-qz-close]').addEventListener('click', this.closeQuiz.bind(this));
      this.backBtn.addEventListener('click', () => {
        this.step = Math.max(0, this.step - 1);
        this.drawStep();
      });
      this.scrim.addEventListener('click', (e) => {
        if (e.target === this.scrim) this.closeQuiz();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this.scrim.hidden) this.closeQuiz();
      });

      // re-sync when the shopper changes the variant (Dawn fires change on the option inputs)
      this.container.addEventListener('change', (e) => {
        if (e.target.closest('variant-selects, variant-radios, .product-form__input')) {
          clearTimeout(this._vt);
          this._vt = setTimeout(() => this.renderSlot(true), 250);
        }
      });
      // keep instances in sync if dogs change elsewhere
      document.addEventListener('qcalc:dogs-changed', () => {
        this.dogs = loadDogs();
        this.renderSlot(true);
      });

      this.renderSlot(true);
    }

    /* ---------- current variant + calculation ---------- */
    currentVariantId() {
      var input = this.container.querySelector && this.container.querySelector('[name="id"]');
      if (input && input.value) return String(input.value);
      return String(this.cfg.selectedVariantId || '');
    }
    currentVariant() {
      var id = this.currentVariantId();
      var vs = this.cfg.variants || [];
      for (var i = 0; i < vs.length; i++) if (String(vs[i].id) === id) return vs[i];
      return vs[0] || { title: '', id: id };
    }
    /* cups a single bag of the selected variant holds */
    variantCups(variant) {
      var t = this.cfg.table;
      var oz = bagOzFromTitle(variant.title);
      if (!oz || !t.fullBagOz || !t.cupsPerBag) return t.cupsPerBag || 0;
      return (t.cupsPerBag * oz) / t.fullBagOz;
    }
    totalDailyCups() {
      var bands = this.cfg.table.bands;
      return this.dogs.reduce((a, d) => a + dailyCups(d, bands), 0);
    }
    /* the recommended plan for the current variant + saved dogs */
    plan() {
      var v = this.currentVariant();
      var vc = this.variantCups(v);
      var daily = this.totalDailyCups();
      var cadence = this.cfg.cadenceDays || 28;
      var qty = vc > 0 && daily > 0 ? Math.max(1, Math.ceil((daily * cadence) / vc)) : 1;
      var daysPerBag = vc > 0 && daily > 0 ? Math.round(vc / daily) : 0;
      return { variant: v, variantCups: vc, daily: daily, qty: qty, daysPerBag: daysPerBag, cadence: cadence };
    }

    /* push the recommended quantity into Dawn's quantity input */
    syncQty(qty) {
      var input =
        document.getElementById('Quantity-' + this.sectionId) ||
        (this.container.querySelector && this.container.querySelector('.quantity__input'));
      if (!input) return;
      if (String(input.value) === String(qty)) return;
      input.value = qty;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /* ---------- CTA / summary ---------- */
    renderSlot(syncQuantity) {
      if (!this.dogs.length) {
        this.slotEl.innerHTML =
          '<button type="button" class="qcalc__cta" data-open>' +
          '<span class="qcalc__cta-text">Not sure how much to order?' +
          ' <u>Let us help decide</u></span>' +
          '<span class="qcalc__cta-arrow" aria-hidden="true">&rarr;</span>' +
          '</button>';
        this.slotEl.querySelector('[data-open]').addEventListener('click', () => this.openQuiz(null));
        return;
      }

      var p = this.plan();
      var bands = this.cfg.table.bands;
      var many = this.dogs.length > 1;
      var rows = this.dogs
        .map((d, i) => {
          return (
            '<div class="qcalc__dog">' +
            '<div class="qcalc__dog-top">' +
            '<b>' +
            (d.name ? esc(d.name) + ' · ' : '') +
            esc(d.weight) +
            ' lb ' +
            esc(stageLabel(d.stage)) +
            '</b>' +
            '<span class="qcalc__dog-acts">' +
            '<button type="button" data-edit="' + i + '">Edit</button>' +
            '<button type="button" data-del="' + i + '">Remove</button>' +
            '</span></div>' +
            // per-dog intake only helps when there's more than one dog; a single
            // dog's intake lives in the foot (matches the design)
            (many ? '<div class="qcalc__dog-eat">Eats <b>' + fmtCups(dailyCups(d, bands)) + '</b> a day</div>' : '') +
            '</div>'
          );
        })
        .join('');

      this.slotEl.innerHTML =
        '<div class="qcalc__summary">' +
        rows +
        '<div class="qcalc__summary-foot">' +
        '<span>' +
        (this.dogs.length > 1 ? 'Together they eat ' : 'Eats ') +
        '<b>' +
        fmtCups(p.daily) +
        '</b> a day</span>' +
        '<button type="button" data-add>+ Add another dog</button>' +
        '</div></div>';

      this.slotEl.querySelectorAll('[data-edit]').forEach((b) =>
        b.addEventListener('click', () => this.openQuiz(+b.dataset.edit))
      );
      this.slotEl.querySelectorAll('[data-del]').forEach((b) =>
        b.addEventListener('click', () => this.removeDog(+b.dataset.del))
      );
      this.slotEl.querySelector('[data-add]').addEventListener('click', () => this.openQuiz(null));

      if (syncQuantity) this.syncQty(p.qty);
    }

    removeDog(i) {
      this.dogs.splice(i, 1);
      saveDogs(this.dogs);
      this.renderSlot(true);
    }

    /* ---------- quiz ---------- */
    openQuiz(idx) {
      this.editIdx = idx == null ? null : idx;
      this.draft =
        this.editIdx != null
          ? Object.assign({}, this.dogs[this.editIdx])
          : { id: uid(), weight: 40, stage: 'adult', name: '' };
      this.step = 0;
      this.scrim.hidden = false;
      document.documentElement.style.overflow = 'hidden';
      this.drawStep();
    }
    closeQuiz() {
      this.scrim.hidden = true;
      document.documentElement.style.overflow = '';
    }

    drawStep() {
      var d = this.draft;
      var n = this.step;
      var LAST = 3; // 3 input steps (0,1,2) then the result (3)

      this.backBtn.hidden = !(n > 0 && n < LAST);
      this.dots.innerHTML =
        n < LAST
          ? Array.from({ length: LAST }, (_, i) => '<i class="' + (i <= n ? 'on' : '') + '"></i>').join('')
          : '';

      if (n === 0) {
        this.body.innerHTML =
          '<div class="qz-step">Step 1 of 3</div>' +
          '<h2>How much does your dog weigh?</h2>' +
          '<p class="qz-sub">This is the number that decides everything else — bag size, quantity, and how often we ship.</p>' +
          '<div class="qz-wbig" data-wbig>' + d.weight + '<span>lbs</span></div>' +
          '<input type="range" class="qz-range" data-wrange min="3" max="130" step="1" value="' + d.weight + '">' +
          '<div class="qz-scale"><span>3 lbs</span><span>130 lbs</span></div>' +
          '<div class="qz-presets">' +
          WEIGHT_PRESETS.map((w) => '<button type="button" data-w="' + w + '">' + w + ' lbs</button>').join('') +
          '</div>' +
          '<div class="qz-foot"><button type="button" class="qz-next" data-next>Continue</button></div>';
        var wbig = this.body.querySelector('[data-wbig]');
        var range = this.body.querySelector('[data-wrange]');
        var set = (v) => {
          d.weight = v;
          range.value = v;
          wbig.innerHTML = v + '<span>lbs</span>';
        };
        range.addEventListener('input', (e) => set(+e.target.value));
        this.body.querySelectorAll('[data-w]').forEach((b) =>
          b.addEventListener('click', () => set(+b.dataset.w))
        );
      } else if (n === 1) {
        this.body.innerHTML =
          '<div class="qz-step">Step 2 of 3</div>' +
          '<h2>How old is your dog?</h2>' +
          '<p class="qz-sub">Dogs under a year are still growing — they eat about double the adult serving.</p>' +
          '<div class="qz-opts">' +
          STAGES.map(
            ([v, t, s]) =>
              '<button type="button" class="qz-opt ' + (d.stage === v ? 'on' : '') + '" data-v="' + v + '">' +
              '<b>' + t + '</b><small>' + s + '</small></button>'
          ).join('') +
          '</div>' +
          '<div class="qz-foot"><button type="button" class="qz-next" data-next>Continue</button></div>';
        this.body.querySelectorAll('.qz-opt').forEach((b) =>
          b.addEventListener('click', () => {
            d.stage = b.dataset.v;
            this.body.querySelectorAll('.qz-opt').forEach((x) => x.classList.remove('on'));
            b.classList.add('on');
          })
        );
      } else if (n === 2) {
        this.body.innerHTML =
          '<div class="qz-step">Step 3 of 3</div>' +
          '<h2>And who are we feeding?</h2>' +
          '<p class="qz-sub">We\'ll label the plan with their name so every delivery is sized to the right dog.</p>' +
          '<div class="qz-name"><input type="text" data-name maxlength="16" placeholder="e.g. Bella" value="' +
          esc(d.name || '') + '" autocomplete="off"></div>' +
          '<div class="qz-foot"><button type="button" class="qz-next" data-next ' +
          (d.name ? '' : 'disabled') + '>See my plan</button></div>';
        var ni = this.body.querySelector('[data-name]');
        var next = this.body.querySelector('[data-next]');
        ni.addEventListener('input', (e) => {
          d.name = e.target.value.replace(/[^\p{L}\p{M}\s'-]/gu, '').trim();
          next.disabled = !d.name;
        });
        ni.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && d.name) next.click();
        });
        setTimeout(() => ni.focus(), 40);
      } else {
        this.drawResult();
        return;
      }

      var nx = this.body.querySelector('[data-next]');
      if (nx)
        nx.addEventListener('click', () => {
          if (this.step < LAST) {
            this.step++;
            this.drawStep();
          }
        });
    }

    drawResult() {
      var d = this.draft;
      var bands = this.cfg.table.bands;
      // household intake if the draft were committed
      var peers = this.dogs.filter((x, i) => i !== this.editIdx);
      var daily = peers.reduce((a, x) => a + dailyCups(x, bands), 0) + dailyCups(d, bands);
      var v = this.currentVariant();
      var vc = this.variantCups(v);
      var cadence = this.cfg.cadenceDays || 28;
      var qty = vc > 0 && daily > 0 ? Math.max(1, Math.ceil((daily * cadence) / vc)) : 1;
      var daysPerBag = vc > 0 && daily > 0 ? Math.round(vc / daily) : 0;
      var kibbleCups = cupsPerDay(d.weight, bands) * 2 * (d.stage === 'puppy' ? 2 : 1);
      var poss = d.name ? (/s$/i.test(d.name) ? d.name + "'" : d.name + "'s") : 'Your';

      this.body.innerHTML =
        '<div class="qz-result">' +
        '<div class="qz-step">' + esc(poss) + ' plan</div>' +
        '<div class="qz-plan">' + qty + ' × ' + esc(bagLabelFromTitle(v.title)) +
        '<br><em>every ' + Math.round(cadence / 7) + ' weeks</em></div>' +
        '<div class="qz-grid">' +
        '<div><b>' + fmtCups(daily) + '</b><small>' + (peers.length ? 'needed daily, together' : 'needed daily') + '</small></div>' +
        '<div><b>' + (daysPerBag || '—') + '</b><small>days per bag</small></div>' +
        '</div>' +
        '<div class="qz-know"><span class="qz-know-lab">Did you know?</span>' +
        '<p>Air-dried food packs up to <b>2× the calories per cup</b> of dry kibble. Where kibble would take around ' +
        fmtCups(kibbleCups) + ' a day, ' + esc(d.name || 'your dog') + ' needs just <b>' + fmtCups(dailyCups(d, bands)) +
        '</b>' + (peers.length ? ' alongside the rest of the pack' : '') + ' — every bag goes about twice as far as it looks.</p></div>' +
        '</div>' +
        '<div class="qz-foot">' +
        '<button type="button" class="qz-next" data-use>Use this plan</button>' +
        '<button type="button" class="qz-add" data-again>+ Add another dog</button>' +
        '</div>';

      this.body.querySelector('[data-use]').addEventListener('click', () => this.commit(false));
      this.body.querySelector('[data-again]').addEventListener('click', () => this.commit(true));
    }

    commit(addAnother) {
      if (!this.draft.name) return;
      if (this.editIdx != null) this.dogs[this.editIdx] = Object.assign({}, this.draft);
      else this.dogs.push(Object.assign({}, this.draft));
      saveDogs(this.dogs);
      this.renderSlot(true);
      if (addAnother) {
        this.openQuiz(null);
      } else {
        this.closeQuiz();
      }
    }
  }

  if (!customElements.get('quantity-calculator')) {
    customElements.define('quantity-calculator', QuantityCalculator);
  }
})();
