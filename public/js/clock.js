// Single clock page (/clock?id=123)

(async () => {
  const container = document.getElementById('clock-detail');
  const id = new URLSearchParams(location.search).get('id');
  const e = Dials.escape;

  const notFound = () => {
    container.innerHTML = `<div class="empty" style="grid-column:1/-1">
      <h3>Clock not found</h3><p>It may have been sold or removed.</p>
      <a class="btn btn-primary" href="/shop">Back to the shop</a></div>`;
  };

  if (!/^\d+$/.test(id || '')) return notFound();
  const res = await fetch(`/api/clocks/${id}`).catch(() => null);
  if (!res || !res.ok) return notFound();
  const { clock } = await res.json();

  document.title = `${clock.title} | Dials Antique Clocks`;
  document.getElementById('crumb').textContent = clock.title;

  const images = clock.images.length ? clock.images : ['/img/clocks/placeholder.svg'];
  const specs = [
    ['Type', clock.type],
    ['Maker', clock.maker],
    ['Origin', clock.origin],
    ['Date', clock.period],
    ['Dimensions', clock.dimensions],
  ].filter(([, v]) => v);

  const price = clock.status === 'sold' ? 'Sold' : Dials.formatPrice(clock.price);

  container.innerHTML = `
    <div>
      <div class="gallery-main"><img id="main-img" src="${e(images[0])}" alt="${e(clock.title)}"></div>
      ${images.length > 1 ? `<div class="thumbs">${images.map((src, i) => `
        <button type="button" data-src="${e(src)}" aria-current="${i === 0}" aria-label="Show photo ${i + 1}">
          <img src="${e(src)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
    </div>
    <div>
      <span class="eyebrow">${e(clock.type)}${clock.origin ? ' · ' + e(clock.origin) : ''}</span>
      <h1 style="font-size:clamp(2rem,4vw,2.8rem)">${e(clock.title)}</h1>
      <div class="detail-price">${price}
        ${clock.status === 'reserved' ? '<span class="badge badge-reserved" style="position:static;vertical-align:middle;margin-left:.5rem">Reserved</span>' : ''}
      </div>
      <div class="description">${e(clock.description)}</div>
      ${specs.length ? `<dl class="specs">${specs.map(([k, v]) => `<dt>${k}</dt><dd>${e(v)}</dd>`).join('')}</dl>` : ''}
      <p class="muted" style="font-size:.9rem">Fully overhauled and guaranteed for ${clock.type === 'Longcase' ? 'eighteen' : 'twelve'} months. Worldwide delivery available.</p>
      ${clock.status !== 'sold' ? `
      <div class="enquire">
        <h3 style="margin:0">Interested in this clock?</h3>
        <p class="muted" style="margin:.25rem 0 0">Call us to arrange a viewing, ask a question or reserve it.</p>
        <div class="actions">
          <a class="btn btn-primary" href="tel:+441590673258">Call 01590 673258</a>
          <a class="btn btn-outline" href="/shop">Keep browsing</a>
        </div>
      </div>` : `<a class="btn btn-outline" href="/shop">See clocks still available</a>`}
    </div>`;

  container.querySelectorAll('.thumbs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('main-img').src = btn.dataset.src;
      container.querySelectorAll('.thumbs button').forEach((b) => b.setAttribute('aria-current', String(b === btn)));
    });
  });
})();
