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

  statusBadge(status) {
    if (status === 'reserved') return '<span class="badge badge-reserved">Reserved</span>';
    if (status === 'sold') return '<span class="badge badge-sold">Sold</span>';
    return '';
  },

  card(clock) {
    const e = Dials.escape;
    const meta = [clock.maker, clock.period].filter(Boolean).map(e).join(' · ');
    return `
      <a class="card${clock.status === 'sold' ? ' is-sold' : ''}" href="/clock?id=${clock.id}">
        <div class="card-img">
          <img src="${e(Dials.firstImage(clock))}" alt="${e(clock.title)}" loading="lazy">
          ${Dials.statusBadge(clock.status)}
        </div>
        <div class="card-body">
          <span class="card-type">${e(clock.type)}${clock.origin ? ' · ' + e(clock.origin) : ''}</span>
          <h3>${e(clock.title)}</h3>
          ${meta ? `<div class="card-meta">${meta}</div>` : ''}
          <div class="card-price">${clock.status === 'sold' ? 'Sold' : Dials.formatPrice(clock.price)}</div>
        </div>
      </a>`;
  },
};
