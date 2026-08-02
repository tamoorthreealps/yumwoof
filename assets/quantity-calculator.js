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
  // Dogs are saved PER PRODUCT (quantity is sized to each product's own feeding
  // table) and expire after 7 days.
  var STORE_PREFIX = 'yumwoof_qcalc_p';
  var TTL_MS = 7 * 24 * 60 * 60 * 1000;
  function storeKey(pid) {
    return STORE_PREFIX + pid;
  }
  function loadDogs(pid) {
    try {
      var raw = localStorage.getItem(storeKey(pid));
      if (!raw) return [];
      var obj = JSON.parse(raw);
      if (!obj || !obj.ts || Date.now() - obj.ts > TTL_MS) {
        localStorage.removeItem(storeKey(pid));
        return [];
      }
      return Array.isArray(obj.dogs) ? obj.dogs : [];
    } catch (e) {
      return [];
    }
  }
  function saveDogs(pid, dogs) {
    try {
      if (!dogs || !dogs.length) localStorage.removeItem(storeKey(pid));
      else localStorage.setItem(storeKey(pid), JSON.stringify({ dogs: dogs, ts: Date.now() }));
    } catch (e) {}
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

      // Shopify number_decimal metaobject fields come through as strings
      // ("20.0", "0.2"); coerce every table number so the math is real.
      var t = this.cfg.table;
      t.cupsPerBag = Number(t.cupsPerBag) || 0;
      t.fullBagOz = Number(t.fullBagOz) || 0;
      t.trialBagOz = Number(t.trialBagOz) || 0;
      t.bands = t.bands.map(function (b) {
        return { minW: Number(b.minW), maxW: Number(b.maxW), minC: Number(b.minC), maxC: Number(b.maxC) };
      });

      this.debug = /[?&]qcalc(debug)?=1/.test(location.search) || window.QCALC_DEBUG === true;
      if (this.debug) console.log('[qcalc] config parsed', JSON.parse(JSON.stringify(this.cfg)));

      this.sectionId = this.getAttribute('data-section');
      this.productId = this.getAttribute('data-product');
      this.slotEl = this.querySelector('[data-qcalc-slot]');
      this.scrim = this.querySelector('[data-qz-scrim]');
      this.body = this.querySelector('[data-qz-body]');
      this.dots = this.querySelector('[data-qz-dots]');
      this.backBtn = this.querySelector('[data-qz-back]');
      this.container = this.closest('.shopify-section, section, product-info') || document;

      // Move the modal to <body> so position:fixed centres on the viewport — an
      // ancestor transform (theme animations) otherwise makes it a containing
      // block and the modal lands off-centre inside the buy column.
      if (this.scrim.parentNode !== document.body) document.body.appendChild(this.scrim);

      this.dogs = loadDogs(this.productId);
      this.draft = null;
      this.editIdx = null;
      this.step = 0;

      // modal chrome
      this.scrim.querySelector('[data-qz-close]').addEventListener('click', this.closeQuiz.bind(this));
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

      // recompute the coverage line when the shopper nudges the quantity stepper
      this.container.addEventListener('change', (e) => {
        if (e.target.closest('.product-form__quantity')) this.renderCoverage();
      });

      // re-sync when the shopper changes the recipe/size. Dawn updates [name="id"]
      // asynchronously (it fetches the section), so a fixed delay can read the OLD
      // variant. Poll until the id actually changes, then recompute.
      var onVariantTouch = (e) => {
        // the quantity stepper is also a .product-form__input — nudging it must
        // NOT be treated as a variant change (it would reset the manual quantity).
        if (e.target.closest('.product-form__quantity')) return;
        if (e.target.closest('variant-selects, variant-radios, .product-form__input, fieldset')) {
          this.watchVariant();
        }
      };
      this.container.addEventListener('change', onVariantTouch);
      this.container.addEventListener('click', onVariantTouch);

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
    /* wait for Dawn to actually swap [name="id"] to the new variant, then recompute */
    watchVariant() {
      var start = this.currentVariantId();
      var self = this;
      var tries = 0;
      clearInterval(this._poll);
      this._poll = setInterval(function () {
        tries++;
        var changed = self.currentVariantId() !== start;
        if (changed || tries >= 24) {
          clearInterval(self._poll);
          if (changed) {
            // bag size changed → re-sync the recommended quantity
            if (self.debug) console.log('[qcalc] variant changed →', self.currentVariant().title);
            self.renderSlot(true);
          } else {
            // no variant change (e.g. re-selecting the current option) → keep the
            // shopper's quantity, just refresh the coverage line
            self.renderCoverage();
          }
        }
      }, 100);
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
      var p = { variant: v, variantCups: vc, daily: daily, qty: qty, daysPerBag: daysPerBag, cadence: cadence };
      if (this.debug) {
        var bands = this.cfg.table.bands;
        console.groupCollapsed('[qcalc] plan → ' + qty + ' × ' + bagLabelFromTitle(v.title));
        console.log('variant:', v.title, '| bag oz:', bagOzFromTitle(v.title), '| fullBagOz:', this.cfg.table.fullBagOz, '| cupsPerBag(full):', this.cfg.table.cupsPerBag);
        console.log('variant cups/bag =', vc);
        console.table(
          this.dogs.map(function (d) {
            return {
              name: d.name, weight: d.weight, stage: d.stage,
              cupsPerDay_base: cupsPerDay(d.weight, bands),
              dailyCups: dailyCups(d, bands),
            };
          })
        );
        console.log('total daily cups =', daily, '| cadence days =', cadence);
        console.log('qty = ceil(daily × cadence / variantCups) = ceil(' + daily + ' × ' + cadence + ' / ' + vc + ') =', qty);
        console.log('days per bag = round(variantCups / daily) =', daysPerBag);
        console.groupEnd();
      }
      return p;
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
        this.renderCoverage();
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
      this.renderCoverage();
    }

    /* names joined for the coverage line ("Bella", "Bella & Max", …) */
    dogNames() {
      var names = this.dogs.filter((d) => d.name).map((d) => d.name);
      if (!names.length) return '';
      if (names.length === 1) return names[0];
      if (names.length === 2) return names[0] + ' & ' + names[1];
      return names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];
    }

    qtyInputValue() {
      var input =
        document.getElementById('Quantity-' + this.sectionId) ||
        (this.container.querySelector && this.container.querySelector('.quantity__input'));
      return input ? Math.max(1, parseInt(input.value, 10) || 1) : 1;
    }

    /* how the CURRENT quantity lands against the delivery cycle */
    coverage(qty) {
      var v = this.currentVariant();
      var vc = this.variantCups(v);
      var daily = this.totalDailyCups();
      var cadence = this.cfg.cadenceDays || 28;
      if (!daily || !vc) return null;
      var days = Math.round((qty * vc) / daily);
      var fitQty = Math.max(1, Math.ceil((daily * cadence) / vc));
      var gap = days - cadence;
      var base = { days: days, names: this.dogNames(), fixQty: fitQty };
      if (gap < -0.5)
        return Object.assign(base, { warn: true, mark: '! ', text: 'Runs out ' + Math.round(-gap) + ' days before the next delivery' });
      if (gap > cadence * 0.6)
        return Object.assign(base, { warn: false, mark: '✓ ', text: Math.round(gap) + ' days spare every cycle — it’ll pile up' });
      return Object.assign(base, {
        warn: false,
        mark: '✓ ',
        text: 'Covers your ' + Math.round(cadence / 7) + '-week cycle' + (gap > 1 ? ', ' + Math.round(gap) + ' days spare' : ''),
      });
    }

    /* inject the "N days of food / coverage" cell beside the theme stepper */
    renderCoverage() {
      var block = this.container.querySelector && this.container.querySelector('.product-form__quantity');
      if (!block) return;
      var qi = block.querySelector('quantity-input.quantity') || block.querySelector('.quantity');
      if (!qi) return;
      var box = block.querySelector('.qcalc-qtybox');
      var cov = this.dogs.length ? this.coverage(this.qtyInputValue()) : null;

      if (!cov) {
        // unwrap: put the stepper back where it was and drop the box
        if (box) {
          box.parentNode.insertBefore(qi, box);
          box.remove();
        }
        block.classList.remove('qcalc-qty--lead');
        return;
      }
      block.classList.add('qcalc-qty--lead');
      if (!box) {
        box = document.createElement('div');
        box.className = 'qcalc-qtybox';
        qi.parentNode.insertBefore(box, qi);
        box.appendChild(qi); // move the stepper into the box (left cell)
        var infoNew = document.createElement('div');
        infoNew.className = 'qcalc-qty__info';
        box.appendChild(infoNew);
      }
      var info = box.querySelector('.qcalc-qty__info');
      info.innerHTML =
        '<span class="qcalc-qty__lead"><b>' + cov.days + ' days</b> of food' +
        (cov.names ? ' for ' + esc(cov.names) : '') + '</span>' +
        '<span class="qcalc-qty__cover' + (cov.warn ? ' warn' : '') + '">' +
        cov.mark +
        esc(cov.text) +
        (cov.fixQty && cov.fixQty !== this.qtyInputValue()
          ? ' · <button type="button" data-fix="' + cov.fixQty + '">Send ' + cov.fixQty + '</button>'
          : '') +
        '</span>';
      var fix = info.querySelector('[data-fix]');
      if (fix) fix.addEventListener('click', () => this.syncQty(+fix.dataset.fix));
    }

    removeDog(i) {
      this.dogs.splice(i, 1);
      saveDogs(this.productId, this.dogs);
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
      this.body.className = `qz-content qz-step-${this.step + 1}`;
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
        const updateRangeFill = () => {
        const percent = ((range.value - range.min) / (range.max - range.min)) * 100;
        range.style.background = `linear-gradient(
          to right,
          #000 0%,
          #000 ${percent}%,
          rgba(0,0,0,.1) ${percent}%,
          rgba(0,0,0,.1) 100%
        )`;
      };
        var set = (v) => {
          d.weight = v;
          range.value = v;
          wbig.innerHTML = v + '<span>lbs</span>';
          updateRangeFill();
        };
        range.addEventListener('input', (e) => set(+e.target.value));
        this.body.querySelectorAll('[data-w]').forEach((b) =>
          b.addEventListener('click', () => set(+b.dataset.w))
        );
        updateRangeFill();
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
        '<div class="qz-know"><div class="qz-know-icon">' +
        '<img src="https://cdn.shopify.com/s/files/1/0317/2827/1419/files/Calorie_Badge.svg?v=1785666303" alt="Did you know">' +
        '</div>' +
        '<div class="qz-know-top">' +
        '<span class="qz-know-lab">Did you know?</span>' +
        '<p>Air-dried food packs up to <b>2× the calories per cup</b> of dry kibble. Where kibble would take around ' +
        fmtCups(kibbleCups) + ' a day, ' + esc(d.name || 'your dog') + ' needs just <b>' + fmtCups(dailyCups(d, bands)) +
        '</b>' + (peers.length ? ' alongside the rest of the pack' : '') + ' — every bag goes about twice as far as it looks.</p></div>' +
        '</div>' +
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
      saveDogs(this.productId, this.dogs);
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
