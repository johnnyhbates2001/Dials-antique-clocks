// Shop page: filters are kept in the URL so filtered views can be shared/bookmarked

const els = {
  types: document.getElementById('type-options'),
  origins: document.getElementById('origin-options'),
  min: document.getElementById('min-price'),
  max: document.getElementById('max-price'),
  presets: document.getElementById('price-presets'),
  sold: document.getElementById('include-sold'),
  q: document.getElementById('q'),
  sort: document.getElementById('sort'),
  results: document.getElementById('results'),
  count: document.getElementById('result-count'),
  filters: document.getElementById('filters'),
};

const PRESETS = [
  ['Under £1,000', '', 999],
  ['£1,000 – £2,500', 1000, 2500],
  ['£2,500 – £5,000', 2500, 5000],
  ['Over £5,000', 5000, ''],
];

let params = new URLSearchParams(location.search);

function optionList(container, name, options) {
  const selected = new Set(params.getAll(name));
  container.innerHTML = options.length
    ? options.map((o) => `
        <label class="check">
          <input type="checkbox" name="${name}" value="${Dials.escape(o.value)}"${selected.has(o.value) ? ' checked' : ''}>
          ${Dials.escape(o.value)} <span class="count">${o.count}</span>
        </label>`).join('')
    : '<span class="muted" style="font-size:.85rem">None</span>';
}

function renderPresets() {
  els.presets.innerHTML = PRESETS.map(([label, min, max]) => {
    const active = String(params.get('minPrice') || '') === String(min) && String(params.get('maxPrice') || '') === String(max);
    return `<label class="check"><input type="radio" name="preset" data-min="${min}" data-max="${max}"${active ? ' checked' : ''}> ${label}</label>`;
  }).join('');
}

function syncInputs() {
  els.min.value = params.get('minPrice') || '';
  els.max.value = params.get('maxPrice') || '';
  els.sold.checked = params.get('includeSold') === '1';
  els.q.value = params.get('q') || '';
  els.sort.value = params.get('sort') || 'newest';
  renderPresets();
}

function readInputs() {
  const next = new URLSearchParams();
  const q = els.q.value.trim();
  if (q) next.set('q', q);
  document.querySelectorAll('input[name=type]:checked').forEach((i) => next.append('type', i.value));
  document.querySelectorAll('input[name=origin]:checked').forEach((i) => next.append('origin', i.value));
  if (els.min.value) next.set('minPrice', els.min.value);
  if (els.max.value) next.set('maxPrice', els.max.value);
  if (els.sold.checked) next.set('includeSold', '1');
  if (els.sort.value !== 'newest') next.set('sort', els.sort.value);
  return next;
}

let requestId = 0;
async function load() {
  const id = ++requestId;
  els.results.style.opacity = '.5';
  try {
    const res = await fetch('/api/clocks?' + params.toString());
    const { clocks } = await res.json();
    if (id !== requestId) return;
    els.count.textContent = `${clocks.length} clock${clocks.length === 1 ? '' : 's'}`;
    els.results.innerHTML = clocks.length
      ? clocks.map(Dials.card).join('')
      : `<div class="empty">
           <h3>No clocks match those filters</h3>
           <p>Try a wider price range or fewer types. We often have clocks that aren't listed yet, so it's worth calling 01590 673258.</p>
           <button class="btn btn-outline btn-sm" type="button" onclick="document.getElementById('clear-filters').click()">Clear filters</button>
         </div>`;
  } catch {
    els.results.innerHTML = '<div class="empty"><h3>The clocks couldn\'t be loaded</h3><p>Check your connection and refresh the page.</p></div>';
  } finally {
    if (id === requestId) els.results.style.opacity = '';
  }
}

function update() {
  params = readInputs();
  const qs = params.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  renderPresets();
  load();
}

let debounce;
function updateSoon() {
  clearTimeout(debounce);
  debounce = setTimeout(update, 300);
}

els.filters.addEventListener('change', (e) => {
  if (e.target.name === 'preset') {
    els.min.value = e.target.dataset.min;
    els.max.value = e.target.dataset.max;
  }
  update();
});
els.min.addEventListener('input', updateSoon);
els.max.addEventListener('input', updateSoon);
els.q.addEventListener('input', updateSoon);
els.sort.addEventListener('change', update);

document.getElementById('clear-filters').addEventListener('click', () => {
  els.filters.querySelectorAll('input[type=checkbox], input[type=radio]').forEach((i) => (i.checked = false));
  els.min.value = els.max.value = els.q.value = '';
  update();
});

document.querySelector('.filters-toggle').addEventListener('click', (e) => {
  const open = els.filters.classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', String(open));
});

(async () => {
  syncInputs();
  load();
  try {
    const f = await (await fetch('/api/filters')).json();
    optionList(els.types, 'type', f.types);
    optionList(els.origins, 'origin', f.origins);
  } catch {
    els.types.innerHTML = els.origins.innerHTML = '';
  }
})();
