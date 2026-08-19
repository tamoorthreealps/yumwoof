class CartNotification extends HTMLElement {
  constructor() {
    super();

    this.notification = document.getElementById('cart-notification');
    // This theme's sticky header is <yw-header data-sticky>, not <sticky-header>.
    // Guarded because reveal() only exists if header.js defines it.
    this.header = document.querySelector('yw-header[data-sticky]');
    this.onBodyClick = this.handleBodyClick.bind(this);

    if (!this.notification) return;

    this.notification.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelectorAll('button[type="button"]').forEach((closeButton) =>
      closeButton.addEventListener('click', this.close.bind(this))
    );
  }

  open() {
    if (!this.notification) return;

    this.notification.classList.add('animate', 'active');

    this.notification.addEventListener(
      'transitionend',
      () => {
        this.notification.focus();
        trapFocus(this.notification);
      },
      { once: true }
    );

    document.body.addEventListener('click', this.onBodyClick);

    this.dispatchCartViewEvent();
  }

  // The notification's outer element is server-rendered once at page load, so
  // its `cart` Liquid object reflects the pre-add state. The morphed children
  // (inserted from the /cart/add.js sections response in renderContents) are
  // post-add, but they don't expose the full cart shape we need for the event
  // payload. So we keep an explicit /cart.json fetch on open. Migrating to the
  // factory + filter would require re-rendering the notification element
  // itself in sections, which is out of scope for this PR.
  async dispatchCartViewEvent() {
    const { CartViewEvent } = window.StandardEvents || {};
    if (!CartViewEvent) return;

    try {
      const response = await fetch(`${routes.cart_url}.json`);
      const cart = await response.json();
      if (!cart?.currency) return;

      this.dispatchEvent(
        new CartViewEvent({
          context: 'dialog',
          cart: CartViewEvent.createCartFromAjaxResponse(cart),
        })
      );
    } catch (e) {
      // cart:view is informational; swallow fetch errors
    }
  }

  close() {
    if (!this.notification) return;

    this.notification.classList.remove('active');
    document.body.removeEventListener('click', this.onBodyClick);

    removeTrapFocus(this.activeElement);
  }

  renderContents(parsedState) {
    this.cartItemKey = parsedState.key;
    this.getSectionsToRender().forEach((section) => {
      if (section.id === 'cart-icon-bubble') {
        updateCartIconBubbles(parsedState.sections[section.id]);
        return;
      }

      const sectionElement = document.getElementById(section.id);
      if (!sectionElement) return;

      sectionElement.innerHTML = this.getSectionInnerHTML(
        parsedState.sections[section.id],
        section.selector
      );
    });

    if (this.header && typeof this.header.reveal === 'function') this.header.reveal();
    this.open();
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-notification-product',
        selector: `[id="cart-notification-product-${this.cartItemKey}"]`,
      },
      {
        id: 'cart-notification-button',
      },
      {
        id: 'cart-icon-bubble',
      },
    ];
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  handleBodyClick(evt) {
    const target = evt.target;
    if (target !== this.notification && !target.closest('cart-notification')) {
      const disclosure = target.closest('details-disclosure, header-menu');
      this.activeElement = disclosure ? disclosure.querySelector('summary') : null;
      this.close();
    }
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-notification', CartNotification);