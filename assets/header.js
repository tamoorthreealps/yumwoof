/**
 * Yumwoof header behaviour.
 * <yw-header> wraps the announcement topbar, the navbar and the mobile overlay.
 * Responsibilities:
 *   - Open / close the full-screen mobile menu overlay (with body scroll lock).
 *   - Optional sticky-on-scroll: hide on scroll down, reveal on scroll up.
 * The desktop mega menu is CSS-only (hover / focus-within), so needs no JS.
 */
class YwHeader extends HTMLElement {
  constructor() {
    super();
    this.toggle = this.querySelector('.yw-nav__toggle');
    this.overlay = this.querySelector('.yw-mobile-menu');
    this.closeBtn = this.querySelector('.yw-mobile-menu__close');
    this.sticky = this.hasAttribute('data-sticky');
    this.lastScroll = 0;

    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
    this.onScroll = this.onScroll.bind(this);
  }

  connectedCallback() {
    if (this.toggle && this.overlay) {
      this.toggle.addEventListener('click', this.open);
      if (this.closeBtn) this.closeBtn.addEventListener('click', this.close);
      document.addEventListener('keydown', this.onKeydown);

      // Close the overlay when a link inside it is followed.
      this.overlay.addEventListener('click', (event) => {
        if (event.target.closest('a')) this.close();
      });
    }

    if (this.sticky) {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    }

    this.setHeaderHeight();
    this._onResize = this.setHeaderHeight.bind(this);
    window.addEventListener('resize', this._onResize, { passive: true });
  }

  disconnectedCallback() {
    if (this.toggle) this.toggle.removeEventListener('click', this.open);
    if (this.closeBtn) this.closeBtn.removeEventListener('click', this.close);
    document.removeEventListener('keydown', this.onKeydown);
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this._onResize);
    document.body.classList.remove('yw-menu-open');
  }

  setHeaderHeight() {
    document.documentElement.style.setProperty('--yw-header-height', `${this.offsetHeight}px`);
  }

  isOpen() {
    return this.overlay.classList.contains('is-open');
  }

  open() {
    this.overlay.classList.add('is-open');
    document.body.classList.add('yw-menu-open');
    this.toggle.setAttribute('aria-expanded', 'true');
    if (this.closeBtn) this.closeBtn.focus();
  }

  close() {
    this.overlay.classList.remove('is-open');
    document.body.classList.remove('yw-menu-open');
    this.toggle.setAttribute('aria-expanded', 'false');
  }

  onKeydown(event) {
    if (event.key === 'Escape' && this.isOpen()) {
      this.close();
      this.toggle.focus();
    }
  }

  onScroll() {
    if (this.isOpen()) return;

    const current = window.pageYOffset || document.documentElement.scrollTop;

    if (current <= 0) {
      this.classList.remove('yw-header--hidden');
      this.lastScroll = current;
      return;
    }

    if (current > this.lastScroll && current > this.offsetHeight) {
      this.classList.add('yw-header--hidden');
    } else {
      this.classList.remove('yw-header--hidden');
    }

    this.lastScroll = current;
  }
}

if (!customElements.get('yw-header')) {
  customElements.define('yw-header', YwHeader);
}


const megaItems = document.querySelectorAll('.yw-nav__item--mega');

let removeTimer;

megaItems.forEach((item) => {
  item.addEventListener('mouseenter', () => {
    clearTimeout(removeTimer);
    document.body.classList.add('is-open');
  });

  item.addEventListener('mouseleave', () => {
    removeTimer = setTimeout(() => {
      document.body.classList.remove('is-open');
    }, 1000);
  });
});