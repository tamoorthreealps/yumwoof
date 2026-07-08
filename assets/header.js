/**
 * Yumwoof header behaviour.
 * <yw-header> is a custom element wrapping the announcement topbar + navbar.
 * Responsibilities:
 *   - Toggle the mobile navigation panel.
 *   - Optional sticky-on-scroll: hide on scroll down, reveal on scroll up.
 */
class YwHeader extends HTMLElement {
  constructor() {
    super();
    this.nav = this.querySelector('.yw-nav');
    this.toggle = this.querySelector('.yw-nav__toggle');
    this.sticky = this.hasAttribute('data-sticky');
    this.lastScroll = 0;

    this.onToggle = this.onToggle.bind(this);
    this.onDocClick = this.onDocClick.bind(this);
    this.onScroll = this.onScroll.bind(this);
  }

  connectedCallback() {
    if (this.toggle && this.nav) {
      this.toggle.addEventListener('click', this.onToggle);
      document.addEventListener('click', this.onDocClick);
    }

    if (this.sticky) {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    }

    this.setHeaderHeight();
    window.addEventListener('resize', this.setHeaderHeight.bind(this), { passive: true });
  }

  disconnectedCallback() {
    if (this.toggle) this.toggle.removeEventListener('click', this.onToggle);
    document.removeEventListener('click', this.onDocClick);
    window.removeEventListener('scroll', this.onScroll);
  }

  setHeaderHeight() {
    document.documentElement.style.setProperty('--yw-header-height', `${this.offsetHeight}px`);
  }

  isOpen() {
    return this.nav.getAttribute('data-menu-open') === 'true';
  }

  setOpen(open) {
    this.nav.setAttribute('data-menu-open', open ? 'true' : 'false');
    if (this.toggle) this.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  onToggle(event) {
    event.stopPropagation();
    this.setOpen(!this.isOpen());
  }

  onDocClick(event) {
    if (this.isOpen() && !this.nav.contains(event.target)) {
      this.setOpen(false);
    }
  }

  onScroll() {
    const current = window.pageYOffset || document.documentElement.scrollTop;

    // Reveal when near the very top.
    if (current <= 0) {
      this.classList.remove('yw-header--hidden');
      this.lastScroll = current;
      return;
    }

    if (current > this.lastScroll && current > this.offsetHeight) {
      // Scrolling down – hide (unless the mobile menu is open).
      if (!this.isOpen()) this.classList.add('yw-header--hidden');
    } else {
      // Scrolling up – reveal.
      this.classList.remove('yw-header--hidden');
    }

    this.lastScroll = current;
  }
}

if (!customElements.get('yw-header')) {
  customElements.define('yw-header', YwHeader);
}
