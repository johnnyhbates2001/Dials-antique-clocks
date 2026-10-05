// Shared helpers for every public page

// Mobile nav
document.querySelector('.nav-toggle')?.addEventListener('click', (e) => {
  const nav = document.getElementById('nav');
  const open = nav.classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', String(open));
});

document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

window.Dials = {
  formatPrice(price) {
    if (price === null || price === undefined) return 'Price on request';
    return '£' + Number(price).toLocaleString('en-GB');
  },

  escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  },

  firstImage(clock) {
    return clock.images?.[0] || '/img/clocks/placeholder.svg';
  },

  statusLabel(status) {
    if (status === 'reserved') return '<span class="status">Reserved</span>';
    if (status === 'sold') return '<span class="status status-sold">Sold</span>';
    return '';
  },

  // "John Matthew, English, c. 1790"
  metaLine(clock) {
    return [clock.maker, clock.origin, clock.period].filter(Boolean).join(', ');
  },

  card(clock) {
    const e = Dials.escape;
    const meta = Dials.metaLine(clock);
    return `
      <a class="item${clock.status === 'sold' ? ' is-sold' : ''}" href="/clock?id=${clock.id}">
        <div class="item-img">
          <img src="${e(Dials.firstImage(clock))}" alt="${e(clock.title)}" loading="lazy">
          ${Dials.statusLabel(clock.status)}
        </div>
        <h3>${e(clock.title)}</h3>
        ${meta ? `<div class="meta">${e(meta)}</div>` : ''}
        <div class="price">${clock.status === 'sold' ? 'Sold' : Dials.formatPrice(clock.price)}</div>
      </a>`;
  },
};
