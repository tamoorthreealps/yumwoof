class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0, event);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends window.StandardEvents.createViewEventElement(HTMLElement) {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  static pendingCartDataPromise = null;

  connectedCallback() {
    // The factory base class auto-dispatches cart:view from the
    // `view-event-payload` attribute (Liquid filter output). The drawer
    // sets `view-event-trigger="manual"` to skip auto-dispatch.
    super.connectedCallback();

    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') return;
      return this.onCartUpdate();
    });
  }

  // Fetches the full cart shape (used to resolve the cart:lines-update event
  // promise after /cart/add.js, which only returns the added line — not the
  // post-mutation cart aggregates). De-duplicated across concurrent callers.
  static fetchCartData() {
    if (!CartItems.pendingCartDataPromise) {
      const pendingCartDataPromise = fetch(`${routes.cart_url}.json`)
        .then((response) => response.json())
        .catch(() => null)
        .finally(() => {
          if (CartItems.pendingCartDataPromise === pendingCartDataPromise) CartItems.pendingCartDataPromise = null;
        });

      CartItems.pendingCartDataPromise = pendingCartDataPromise;
    }
    return CartItems.pendingCartDataPromise;
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`) || this.querySelector(`#Drawer-quantity-${id}`);
    if (!input) return;
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;
    let message = '';

    if (inputValue < event.target.dataset.min) {
      message = window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min);
    } else if (inputValue > parseInt(event.target.max)) {
      message = window.quickOrderListStrings.max_error.replace('[max]', event.target.max);
    } else if (inputValue % parseInt(event.target.step) !== 0) {
      message = window.quickOrderListStrings.step_error.replace('[step]', event.target.step);
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        event,
        document.activeElement.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  onChange(event) {
    this.validateQuantity(event);
  }

  // Refreshes every cart icon (desktop + mobile) from a standalone
  // ?section_id=cart-icon-bubble render. Kept separate from the drawer/main
  // re-render below because those only touch the cart body, never the header.
  refreshCartIconBubbles() {
    return fetch(`${routes.cart_url}?section_id=cart-icon-bubble`)
      .then((response) => response.text())
      .then((responseText) => updateCartIconBubbles(responseText))
      .catch(() => {
        /* header count is cosmetic; don't break the cart re-render */
      });
  }

  onCartUpdate() {
    const bubbleRefresh = this.refreshCartIconBubbles();

    if (this.tagName === 'CART-DRAWER-ITEMS') {
      return Promise.all([
        bubbleRefresh,
        fetch(`${routes.cart_url}?section_id=cart-drawer`)
          .then((response) => response.text())
          .then((responseText) => {
            const html = new DOMParser().parseFromString(responseText, 'text/html');
            const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
            for (const selector of selectors) {
              const targetElement = document.querySelector(selector);
              const sourceElement = html.querySelector(selector);
              if (targetElement && sourceElement) {
                targetElement.replaceWith(sourceElement);
              }
            }
          })
          .catch((e) => {
            console.error(e);
          }),
      ]);
    }

    return Promise.all([
      bubbleRefresh,
      fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          if (sourceQty) this.innerHTML = sourceQty.innerHTML;
        })
        .catch((e) => {
          console.error(e);
        }),
    ]);
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items')?.dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer')?.dataset.id,
        selector: '.js-contents',
      },
    ].filter((section) => section.section);
  }

  updateQuantity(line, quantity, event, name, variantId) {
    const eventTarget = event.currentTarget instanceof CartRemoveButton ? 'clear' : 'change';
    const cartPerformanceUpdateMarker = CartPerformance.createStartingMarker(`${eventTarget}:user-action`);

    this.enableLoading(line);

    const action = quantity === 0 ? 'remove' : 'update';
    const quantityInput = this.querySelector(`#Quantity-${line}`) || this.querySelector(`#Drawer-quantity-${line}`);
    const lineVariantId = variantId || quantityInput?.dataset.quantityVariantId;
    const lineKey = quantityInput?.dataset.quantityLineKey;
    const linesUpdateDeferred = this.createCartLinesUpdateEvent(action, lineVariantId, quantity, lineKey);

    // Cache sections before the fetch so we read dataset.id while elements still exist in the DOM
    const sectionsToRender = this.getSectionsToRender();

    const body = JSON.stringify({
      line,
      quantity,
      sections: sectionsToRender.map((section) => section.section),
      sections_url: window.location.pathname,
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);

        if (parsedState.errors) {
          this.dispatchCartErrorEvent(parsedState.errors, 'INVALID');
          linesUpdateDeferred?.reject(new Error(parsedState.errors));
        } else {
          this.resolveCartLinesUpdate(linesUpdateDeferred, parsedState);
        }

        CartPerformance.measure(`${eventTarget}:paint-updated-sections`, () => {
          const quantityElement =
            document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
          const items = document.querySelectorAll('.cart-item');

          if (parsedState.errors) {
            quantityElement.value = quantityElement.getAttribute('value');
            this.updateLiveRegions(line, parsedState.errors);
            return;
          }

          this.classList.toggle('is-empty', parsedState.item_count === 0);
          const cartDrawerWrapper = document.querySelector('cart-drawer');
          const cartFooter = document.getElementById('main-cart-footer');

          if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
          if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

          sectionsToRender.forEach((section) => {
            // The cart icon exists twice in the DOM (desktop nav + mobile menu
            // bar) with different ids, so it can't be resolved by id here.
            // [data-cart-icon-bubble] matches both.
            if (section.id === 'cart-icon-bubble') {
              updateCartIconBubbles(parsedState.sections[section.section]);
              return;
            }

            // main-cart-items / main-cart-footer don't exist when the drawer is
            // used off the /cart page. Without this guard the whole callback
            // throws partway through and later sections never render.
            const sectionRoot = document.getElementById(section.id);
            if (!sectionRoot) return;

            const elementToReplace = sectionRoot.querySelector(section.selector) || sectionRoot;
            const newHTML = this.getSectionInnerHTML(parsedState.sections[section.section], section.selector);

            if (newHTML !== null) elementToReplace.innerHTML = newHTML;
          });

          const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
          let message = '';
          if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
            if (typeof updatedValue === 'undefined') {
              message = window.cartStrings.error;
            } else {
              message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
            }
          }
          this.updateLiveRegions(line, message);

          const lineItem =
            document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
          if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
            cartDrawerWrapper
              ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
              : lineItem.querySelector(`[name="${name}"]`).focus();
          } else if (parsedState.item_count === 0 && cartDrawerWrapper?.querySelector('.drawer__inner-empty')) {
            trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
          } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'));
          }
        });

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState, variantId: variantId });
        requestAnimationFrame(() => {
          initEmptyCartSlider();
        });
      })
      .catch((e) => {
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        if (errors) errors.textContent = window.cartStrings.error;
        this.dispatchCartErrorEvent(window.cartStrings.error, 'SERVICE_UNAVAILABLE');
        linesUpdateDeferred?.reject(e);
      })
      .finally(() => {
        this.disableLoading(line);
        CartPerformance.measureFromMarker(`${eventTarget}:user-action`, cartPerformanceUpdateMarker);
      });
  }

  createCartLinesUpdateEvent(action, variantId, quantity, lineKey) {
    const { CartLinesUpdateEvent } = window.StandardEvents || {};
    if (!CartLinesUpdateEvent || !variantId) return null;
    // No AJAX line key on the row — likely cached HTML rendered before this
    // attribute landed. Skip dispatch rather than emit an event with id: ''.
    if (!lineKey) return null;

    const deferred = CartLinesUpdateEvent.createPromise();
    this.dispatchEvent(
      new CartLinesUpdateEvent({
        action,
        context: 'cart',
        lines: [{ id: lineKey, quantity }],
        promise: deferred.promise,
      })
    );
    return deferred;
  }

  resolveCartLinesUpdate(deferred, parsedState) {
    if (!deferred) return;
    const { CartLinesUpdateEvent } = window.StandardEvents || {};
    if (!CartLinesUpdateEvent) return;

    deferred.resolve({ cart: CartLinesUpdateEvent.createCartFromAjaxResponse(parsedState) });
  }

  dispatchCartErrorEvent(message, code) {
    const { CartErrorEvent } = window.StandardEvents || {};
    if (!CartErrorEvent) return;
    this.dispatchEvent(new CartErrorEvent({ error: message, code }));
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').textContent = message;

    if (this.lineItemStatusElement) this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    if (!cartStatus) return;

    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    if (!html) return null;
    const found = new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
    return found ? found.innerHTML : null;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    if (mainCartItems) mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    if (this.lineItemStatusElement) this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    if (mainCartItems) mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const newNote = event.target.value;
            const noteDeferred = this.dispatchNoteUpdateEvent(newNote);

            const body = JSON.stringify({ note: newNote });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } })
              .then((r) => r.json())
              .then((cart) => {
                if (!cart || cart.errors) {
                  throw Object.assign(new Error(cart?.errors), { code: 'INVALID' });
                }

                if (noteDeferred) {
                  const { CartNoteUpdateEvent } = window.StandardEvents || {};
                  if (CartNoteUpdateEvent) {
                    noteDeferred.resolve({ cart: CartNoteUpdateEvent.createCartFromAjaxResponse(cart) });
                  }
                }
                CartPerformance.measureFromEvent('note-update:user-action', event);
              })
              .catch((e) => {
                noteDeferred?.reject(e);
                const { CartErrorEvent } = window.StandardEvents || {};
                if (CartErrorEvent) {
                  this.dispatchEvent(
                    new CartErrorEvent({
                      error: e.message || 'Note update failed',
                      code: e.code || 'SERVICE_UNAVAILABLE',
                    })
                  );
                }
              });
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }

      dispatchNoteUpdateEvent(newNote) {
        const { CartNoteUpdateEvent } = window.StandardEvents || {};
        if (!CartNoteUpdateEvent) return null;

        const context = this.closest('dialog') || this.closest('cart-drawer') ? 'dialog' : 'cart';
        const deferred = CartNoteUpdateEvent.createPromise();

        this.dispatchEvent(
          new CartNoteUpdateEvent({
            context,
            note: newNote,
            promise: deferred.promise,
          })
        );

        return deferred;
      }
    }
  );
}

/* ============================================================
   Empty-cart recommended products slider
   Self-healing: safe to call any number of times. Re-mounts
   whenever the drawer markup is swapped by an AJAX re-render.
   ============================================================ */
let emptyCartSplide = null;

function initEmptyCartSlider() {
  const slider = document.querySelector('.js-empty-cart-slider');

  // The node we mounted on was replaced or removed by a section
  // re-render — tear the old instance down before doing anything else.
  if (emptyCartSplide && emptyCartSplide.root !== slider) {
    try {
      emptyCartSplide.destroy(true);
    } catch (e) {
      /* already detached */
    }
    emptyCartSplide = null;
  }

  if (!slider) return;
  if (slider.classList.contains('is-initialized')) return;

  // Markup arrived but slides haven't (or the collection resolved empty).
  if (!slider.querySelector('.splide__slide')) return;

  // Still display:none — mounting now would measure zero widths.
  if (!slider.offsetParent) return;

  slider.classList.add('is-initialized');

  const splide = new Splide(slider, {
    type: 'slide',
    perPage: 2,
    perMove: 1,
    gap: '12px',
    pagination: false,
    arrows: false,
    drag: true,
    omitEnd: true,
    trimSpace: true,
    focus: 0,
    breakpoints: {
      750: {
        perPage: 1.6,
        gap: '12px',
        omitEnd: true,
        trimSpace: true,
        focus: 0,
      },
    },
  });

  // Scope the arrows to THIS slider's wrapper, not the whole document —
  // two copies can briefly coexist during a swap.
  const wrapper = slider.closest('.cd-shop--main');
  const prevBtn = wrapper?.querySelector('.empty-prev');
  const nextBtn = wrapper?.querySelector('.empty-next');

  function updateArrows() {
    if (!prevBtn || !nextBtn) return;

    prevBtn.disabled = splide.index <= 0;
    nextBtn.disabled = splide.index >= splide.Components.Controller.getEnd();

    prevBtn.classList.toggle('is-disabled', prevBtn.disabled);
    nextBtn.classList.toggle('is-disabled', nextBtn.disabled);
  }

  splide.on('mounted moved resized updated', updateArrows);
  splide.mount();

  prevBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    splide.go('<');
  });

  nextBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    splide.go('>');
  });

  emptyCartSplide = splide;
}

/* Re-run on every drawer mutation, so it doesn't matter which
   cartUpdate subscriber finishes its re-render last. */
function observeCartDrawer() {
  const drawerRoot = document.querySelector('cart-drawer');
  if (!drawerRoot || drawerRoot.dataset.emptySliderObserved) return;

  drawerRoot.dataset.emptySliderObserved = 'true';

  new MutationObserver(() => {
    // rAF lets the browser apply the is-empty class / layout first,
    // so the offsetParent check above reads correctly.
    requestAnimationFrame(initEmptyCartSlider);
  }).observe(drawerRoot, { childList: true, subtree: true });
}

document.addEventListener('DOMContentLoaded', () => {
  observeCartDrawer();
  initEmptyCartSlider();
});

document.addEventListener("click", function (e) {
  if (e.target.classList.contains("cd__inner")) {
    document.querySelector("cart-drawer")?.close();
  }
});



function initRecommendSlider() {
  const slider = document.querySelector(".cd-recommend__slider");

  if (!slider || slider.classList.contains("is-initialized")) return;

  const totalSlides = slider.querySelectorAll(".splide__slide").length;

  slider.classList.add("is-initialized");

  const options = {
    type: "slide",
    perPage: totalSlides === 1 ? 1 : 1.18,
    perMove: 1,
    gap: totalSlides === 1 ? 0 : "16px",
    pagination: false,
    arrows: false,
    drag: totalSlides > 1,
    omitEnd: true,
    trimSpace: true,
    focus: 0,
    breakpoints: {
      1024: {
        perPage: totalSlides === 1 ? 1 : 1.06,
      },
      768: {
        perPage: totalSlides === 1 ? 1 : 1.06,
        gap: totalSlides === 1 ? 0 : "8px",
      },
    },
  };

  const prevBtn = document.querySelector("[data-cd-prev]");
  const nextBtn = document.querySelector("[data-cd-next]");
  const arrowWrap = prevBtn?.closest(".cd-carousel__nav");

  if (totalSlides > 1) {
    options.padding = {
      right: "64px",
    };

    options.breakpoints[1024].padding = {
      right: "64px",
    };

    options.breakpoints[768].padding = {
      right: "16px",
    };
  } else {
    arrowWrap?.classList.add("is-hidden");
  }

  const splide = new Splide(slider, options);

  function updateArrows() {
    if (!prevBtn || !nextBtn || totalSlides <= 1) return;

    prevBtn.disabled = splide.index === 0;
    nextBtn.disabled =
      splide.index >= splide.length - splide.options.perPage;

    prevBtn.classList.toggle("is-disabled", prevBtn.disabled);
    nextBtn.classList.toggle("is-disabled", nextBtn.disabled);
  }

  splide.on("mounted move resized updated", updateArrows);

  splide.mount();
const list = slider.querySelector('.splide__list');
if (list) list.removeAttribute('role');

prevBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  splide.go('<');
});
  prevBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    splide.go("<");
  });

  nextBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    splide.go(">");
  });

  updateArrows();
}