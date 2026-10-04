// Shop admin: log in, then add / edit / remove clocks

const $ = (id) => document.getElementById(id);
const e = Dials.escape;

let clocks = [];
let editing = null; // clock being edited, or null when adding
let photos = [];    // image URLs for the clock in the editor

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/login') {
    showLogin();
    throw new Error('Your session has expired – please log in again');
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function toast(message, isError = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' err' : '');
  el.textContent = message;
  el.setAttribute('role', 'status');
  document.body.append(el);
  setTimeout(() => el.remove(), 3000);
}

// ---------------------------------------------------------------- views

function showLogin() {
  $('login-view').hidden = false;
  $('dashboard-view').hidden = true;
  $('logout').hidden = true;
  if ($('editor').open) $('editor').close();
  $('password').focus();
}

async function showDashboard() {
  $('login-view').hidden = true;
  $('dashboard-view').hidden = false;
  $('logout').hidden = false;
  await loadClocks();
}

$('login-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('login-error').textContent = '';
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({ password: $('password').value }) });
    $('password').value = '';
    showDashboard();
  } catch (err) {
    $('login-error').textContent = err.message;
  }
});

$('logout').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  showLogin();
});

// ---------------------------------------------------------------- list

async function loadClocks() {
  try {
    clocks = (await api('/api/admin/clocks?sort=newest&limit=500')).clocks;
    renderRows();
  } catch (err) {
    toast(err.message, true);
  }
}

function renderRows() {
  const q = $('admin-q').value.trim().toLowerCase();
  const status = $('admin-status').value;
  const rows = clocks.filter((c) =>
    (!status || c.status === status) &&
    (!q || [c.title, c.maker, c.type, c.period].join(' ').toLowerCase().includes(q)));

  const counts = { available: 0, reserved: 0, sold: 0 };
  clocks.forEach((c) => counts[c.status]++);
  $('stats').textContent = `${counts.available} available · ${counts.reserved} reserved · ${counts.sold} sold`;

  $('clock-rows').innerHTML = rows.length ? rows.map((c) => `
    <tr data-id="${c.id}">
      <td class="thumb"><img src="${e(Dials.firstImage(c))}" alt=""></td>
      <td><div class="title">${e(c.title)}</div><div class="sub">${e([c.type, c.maker, c.period].filter(Boolean).join(' · '))}</div></td>
      <td data-label="Price">${e(Dials.formatPrice(c.price))}</td>
      <td>
        <select data-action="status" aria-label="Status">
          ${['available', 'reserved', 'sold'].map((s) => `<option value="${s}"${c.status === s ? ' selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
        </select>
      </td>
      <td><button class="star${c.featured ? ' on' : ''}" data-action="feature" title="${c.featured ? 'Featured on homepage' : 'Not featured'}" aria-pressed="${c.featured}">★</button></td>
      <td class="row-actions">
        <a class="btn btn-outline btn-sm" href="/clock?id=${c.id}" target="_blank" rel="noopener">View</a>
        <button class="btn btn-primary btn-sm" data-action="edit">Edit</button>
      </td>
    </tr>`).join('')
    : `<tr><td colspan="6" class="muted" style="text-align:center;padding:2.5rem">${clocks.length ? 'No clocks match.' : 'No clocks yet – click “Add a clock” to get started.'}</td></tr>`;
}

$('admin-q').addEventListener('input', renderRows);
$('admin-status').addEventListener('change', renderRows);

// Quick status / featured changes straight from the table
async function quickUpdate(clock, changes) {
  try {
    const { clock: saved } = await api(`/api/admin/clocks/${clock.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...clock, ...changes }),
    });
    clocks = clocks.map((c) => (c.id === saved.id ? saved : c));
    renderRows();
    toast('Saved');
  } catch (err) {
    toast(err.message, true);
    renderRows();
  }
}

$('clock-rows').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-action]');
  if (!btn) return;
  const clock = clocks.find((c) => c.id === Number(btn.closest('tr').dataset.id));
  if (btn.dataset.action === 'edit') openEditor(clock);
  if (btn.dataset.action === 'feature') quickUpdate(clock, { featured: !clock.featured });
});

$('clock-rows').addEventListener('change', (ev) => {
  if (ev.target.dataset.action !== 'status') return;
  const clock = clocks.find((c) => c.id === Number(ev.target.closest('tr').dataset.id));
  quickUpdate(clock, { status: ev.target.value });
});

// ---------------------------------------------------------------- editor

const form = $('clock-form');

function openEditor(clock = null) {
  editing = clock;
  form.reset();
  $('editor-title').textContent = clock ? 'Edit clock' : 'Add a clock';
  $('delete-clock').hidden = !clock;
  if (clock) {
    for (const name of ['title', 'type', 'maker', 'origin', 'period', 'year', 'price', 'dimensions', 'description', 'status']) {
      form.elements[name].value = clock[name] ?? '';
    }
    form.elements.featured.checked = clock.featured;
  }
  photos = clock ? [...clock.images] : [];
  renderPhotos();
  $('editor').showModal();
}

$('add-clock').addEventListener('click', () => openEditor());
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => $('editor').close()));

function renderPhotos() {
  $('photos').innerHTML = photos.map((src, i) => `
    <div class="photo${i === 0 ? ' main' : ''}">
      <img src="${e(src)}" alt="">
      ${i === 0 ? '<span class="main-label">Main</span>' : ''}
      <div class="tools">
        ${i === 0 ? '<span></span>' : `<button type="button" data-main="${i}" title="Make main photo">★ Main</button>`}
        <button type="button" data-remove="${i}" title="Remove photo">✕</button>
      </div>
    </div>`).join('') + `
    <div class="upload" id="upload-btn" role="button" tabindex="0">
      <span>+</span>Add photos<br><small>or drop here</small>
    </div>`;
}

$('photos').addEventListener('click', (ev) => {
  const t = ev.target;
  if (t.closest('#upload-btn')) return $('file-input').click();
  if (t.dataset.remove) {
    photos.splice(Number(t.dataset.remove), 1);
    renderPhotos();
  }
  if (t.dataset.main) {
    const [img] = photos.splice(Number(t.dataset.main), 1);
    photos.unshift(img);
    renderPhotos();
  }
});
$('photos').addEventListener('keydown', (ev) => {
  if (ev.target.id === 'upload-btn' && (ev.key === 'Enter' || ev.key === ' ')) {
    ev.preventDefault();
    $('file-input').click();
  }
});
$('photos').addEventListener('dragover', (ev) => {
  ev.preventDefault();
  $('upload-btn')?.classList.add('drag');
});
$('photos').addEventListener('dragleave', () => $('upload-btn')?.classList.remove('drag'));
$('photos').addEventListener('drop', (ev) => {
  ev.preventDefault();
  uploadFiles(ev.dataTransfer.files);
});
$('file-input').addEventListener('change', (ev) => {
  uploadFiles(ev.target.files);
  ev.target.value = '';
});

async function uploadFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  const btn = $('upload-btn');
  btn.innerHTML = '<small>Uploading…</small>';
  $('save-clock').disabled = true;
  for (const file of files) {
    try {
      const body = new FormData();
      body.append('file', await shrinkImage(file));
      const { url } = await api('/api/admin/upload', { method: 'POST', body });
      photos.push(url);
    } catch (err) {
      toast(`${file.name}: ${err.message}`, true);
    }
  }
  $('save-clock').disabled = false;
  renderPhotos();
}

// Resize large phone photos in the browser before uploading (max 2000px, JPEG)
async function shrinkImage(file, maxSize = 2000) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = form.elements;
  if (!f.title.value.trim() || !f.type.value.trim()) {
    toast('Please enter a title and type', true);
    (f.title.value.trim() ? f.type : f.title).focus();
    return;
  }
  const body = {
    title: f.title.value, type: f.type.value, maker: f.maker.value, origin: f.origin.value,
    period: f.period.value, year: f.year.value, price: f.price.value, dimensions: f.dimensions.value,
    description: f.description.value, status: f.status.value, featured: f.featured.checked, images: photos,
  };
  $('save-clock').disabled = true;
  try {
    if (editing) {
      await api(`/api/admin/clocks/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('Clock updated');
    } else {
      await api('/api/admin/clocks', { method: 'POST', body: JSON.stringify(body) });
      toast('Clock added to the shop');
    }
    $('editor').close();
    loadClocks();
  } catch (err) {
    toast(err.message, true);
  } finally {
    $('save-clock').disabled = false;
  }
});

$('delete-clock').addEventListener('click', async () => {
  if (!editing || !confirm(`Delete “${editing.title}”? This removes it from the shop and deletes its photos. This can't be undone.\n\nTip: to keep a record, set its status to Sold instead.`)) return;
  try {
    await api(`/api/admin/clocks/${editing.id}`, { method: 'DELETE' });
    $('editor').close();
    toast('Clock deleted');
    loadClocks();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------------------------------------------------------------- start

api('/api/session')
  .then(({ loggedIn }) => (loggedIn ? showDashboard() : showLogin()))
  .catch(showLogin);
