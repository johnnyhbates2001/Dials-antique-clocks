// Single clock page (/clock?id=123)

(async () => {
  const container = document.getElementById('clock-detail');
  const id = new URLSearchParams(location.search).get('id');
  const e = Dials.escape;

  const notFound = () => {
    container.innerHTML = `<div class="empty">
      <h3>This clock isn't listed any more</h3>
      <p>It may have been sold. Have a look at the clocks still in the shop, or call us on 01590 673258.</p>
      <a class="btn" href="/shop">See the clocks for sale</a></div>`;
  };

  if (!/^\d+$/.test(id || '')) return notFound();
  const res = await fetch(`/api/clocks/${id}`).catch(() => null);
  if (!res || !res.ok) return notFound();
  const { clock } = await res.json();

  document.title = `${clock.title} | Dials of Lymington`;
  document.getElementById('crumb').textContent = clock.title;

  const images = clock.images.length ? clock.images : ['/img/clocks/placeholder.svg'];
  const facts = [
    ['Type', clock.type],
    ['Maker', clock.maker],
    ['Origin', clock.origin],
    ['Date', clock.period],
    ['Size', clock.dimensions],
    ['Guarantee', clock.type === 'Longcase' ? '18 months' : '12 months'],
  ].filter(([, v]) => v);

  const sold = clock.status === 'sold';
  const maker = Dials.metaLine(clock);

  container.innerHTML = `
    <div>
      <div class="gallery-main"><img id="main-img" src="${e(images[0])}" alt="${e(clock.title)}"></div>
      ${images.length > 1 ? `<div class="thumbs">${images.map((src, i) => `
        <button type="button" data-src="${e(src)}" aria-current="${i === 0}" aria-label="Show photo ${i + 1}">
          <img src="${e(src)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
    </div>
    <div>
      <h1>${e(clock.title)}</h1>
      ${maker ? `<p class="maker">${e(maker)}</p>` : ''}
      <div class="detail-price">${sold ? 'Sold' : Dials.formatPrice(clock.price)}
        ${clock.status === 'reserved' ? '<span class="status">Reserved</span>' : ''}</div>
      <div class="description">${e(clock.description)}</div>
      <dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${e(v)}</dd>`).join('')}</dl>
      ${sold ? `<a class="btn btn-outline" href="/shop">See the clocks still for sale</a>` : `
      <div class="enquire">
        <h2>Come and see it</h2>
        <p>Call to arrange a viewing, ask a question or reserve this clock. We deliver anywhere in the world.</p>
        <div class="actions">
          <a class="btn" href="tel:+441590673258">Call 01590 673258</a>
          <a class="text-link" href="/shop">Back to all clocks</a>
        </div>
      </div>`}
    </div>`;

  container.querySelectorAll('.thumbs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('main-img').src = btn.dataset.src;
      container.querySelectorAll('.thumbs button').forEach((b) => b.setAttribute('aria-current', String(b === btn)));
    });
  });
})();
