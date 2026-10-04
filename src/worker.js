// Dials Antique Clocks – Cloudflare Worker
//
// Static pages are served from /public by the assets binding.
// This Worker handles:
//   /api/*     – public clock listings + admin (login, add/edit/remove clocks, upload photos)
//   /images/*  – photos uploaded through the admin, stored in R2

const SESSION_COOKIE = 'dials_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours
const STATUSES = ['available', 'reserved', 'sold'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env, url);
      if (url.pathname.startsWith('/images/')) return await serveImage(env, url);
      return env.ASSETS.fetch(request);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: 'Something went wrong' }, 500);
    }
  },
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

// ---------------------------------------------------------------- routing

async function handleApi(request, env, url) {
  const { pathname } = url;
  const method = request.method;
  let m;

  // Public
  if (pathname === '/api/clocks' && method === 'GET') return listClocks(env, url.searchParams, false);
  if (pathname === '/api/filters' && method === 'GET') return getFilters(env);
  if ((m = pathname.match(/^\/api\/clocks\/(\d+)$/)) && method === 'GET') return getClock(env, +m[1], false);

  // Auth
  if (pathname === '/api/login' && method === 'POST') return login(request, env);
  if (pathname === '/api/logout' && method === 'POST') return logout();
  if (pathname === '/api/session' && method === 'GET') {
    return json({ loggedIn: await isLoggedIn(request, env) });
  }

  // Admin
  if (pathname.startsWith('/api/admin/')) {
    if (!(await isLoggedIn(request, env))) throw new HttpError(401, 'Please log in');
    if (method !== 'GET') checkSameOrigin(request, url);

    if (pathname === '/api/admin/clocks' && method === 'GET') return listClocks(env, url.searchParams, true);
    if (pathname === '/api/admin/clocks' && method === 'POST') return createClock(request, env);
    if ((m = pathname.match(/^\/api\/admin\/clocks\/(\d+)$/))) {
      if (method === 'GET') return getClock(env, +m[1], true);
      if (method === 'PUT') return updateClock(request, env, +m[1]);
      if (method === 'DELETE') return deleteClock(env, +m[1]);
    }
    if (pathname === '/api/admin/upload' && method === 'POST') return uploadImage(request, env);
  }

  throw new HttpError(404, 'Not found');
}

// ---------------------------------------------------------------- public listings

function rowToClock(row) {
  return { ...row, featured: !!row.featured, images: safeJsonArray(row.images) };
}

function safeJsonArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function listClocks(env, params, isAdmin) {
  const where = [];
  const args = [];

  const status = params.get('status');
  if (isAdmin) {
    if (status && STATUSES.includes(status)) {
      where.push('status = ?');
      args.push(status);
    }
  } else if (params.get('includeSold') === '1') {
    // everything
  } else {
    where.push("status != 'sold'");
  }

  const types = params.getAll('type').filter(Boolean);
  if (types.length) {
    where.push(`type IN (${types.map(() => '?').join(',')})`);
    args.push(...types);
  }

  const origins = params.getAll('origin').filter(Boolean);
  if (origins.length) {
    where.push(`origin IN (${origins.map(() => '?').join(',')})`);
    args.push(...origins);
  }

  const min = parseInt(params.get('minPrice'), 10);
  if (!Number.isNaN(min)) {
    where.push('price >= ?');
    args.push(min);
  }
  const max = parseInt(params.get('maxPrice'), 10);
  if (!Number.isNaN(max)) {
    where.push('price <= ?');
    args.push(max);
  }

  const q = (params.get('q') || '').trim();
  if (q) {
    where.push('(title LIKE ? OR maker LIKE ? OR description LIKE ? OR period LIKE ?)');
    const like = `%${q.replace(/[%_]/g, '')}%`;
    args.push(like, like, like, like);
  }

  if (params.get('featured') === '1') where.push('featured = 1');

  const sorts = {
    newest: 'created_at DESC, id DESC',
    'price-asc': 'price IS NULL, price ASC',
    'price-desc': 'price IS NULL, price DESC',
    'age-asc': 'year IS NULL, year ASC',
    'age-desc': 'year IS NULL, year DESC',
  };
  // Sold items always sink to the bottom on the public site
  const orderBy = (isAdmin ? '' : "status = 'sold', ") + (sorts[params.get('sort')] || sorts.newest);

  const limit = Math.min(parseInt(params.get('limit'), 10) || 200, 500);
  const sql =
    `SELECT * FROM clocks ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${orderBy} LIMIT ?`;
  const { results } = await env.DB.prepare(sql).bind(...args, limit).all();
  return json({ clocks: results.map(rowToClock) });
}

async function getClock(env, id, isAdmin) {
  const row = await env.DB.prepare('SELECT * FROM clocks WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'Clock not found');
  return json({ clock: rowToClock(row) }, 200, isAdmin ? {} : { 'cache-control': 'public, max-age=60' });
}

async function getFilters(env) {
  const [types, origins, range] = await env.DB.batch([
    env.DB.prepare("SELECT type AS value, COUNT(*) AS count FROM clocks WHERE status != 'sold' GROUP BY type ORDER BY type"),
    env.DB.prepare(
      "SELECT origin AS value, COUNT(*) AS count FROM clocks WHERE status != 'sold' AND origin IS NOT NULL AND origin != '' GROUP BY origin ORDER BY origin",
    ),
    env.DB.prepare("SELECT MIN(price) AS min, MAX(price) AS max FROM clocks WHERE status != 'sold'"),
  ]);
  return json({
    types: types.results,
    origins: origins.results,
    price: range.results[0] || { min: null, max: null },
  });
}

// ---------------------------------------------------------------- admin: clocks

function cleanText(value, maxLen = 200) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim().slice(0, maxLen);
  return s === '' ? null : s;
}

function cleanInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Math.round(Number(String(value).replace(/[£,\s]/g, '')));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function validateClock(body) {
  const clock = {
    title: cleanText(body.title),
    type: cleanText(body.type, 60),
    maker: cleanText(body.maker),
    origin: cleanText(body.origin, 60),
    period: cleanText(body.period, 60),
    year: cleanInt(body.year),
    price: cleanInt(body.price),
    description: cleanText(body.description, 10000) || '',
    dimensions: cleanText(body.dimensions),
    images: JSON.stringify(
      (Array.isArray(body.images) ? body.images : [])
        .filter((u) => typeof u === 'string' && /^\/(images|img)\//.test(u))
        .slice(0, 20),
    ),
    status: STATUSES.includes(body.status) ? body.status : 'available',
    featured: body.featured ? 1 : 0,
  };
  if (!clock.title) throw new HttpError(400, 'Title is required');
  if (!clock.type) throw new HttpError(400, 'Type is required');
  return clock;
}

const CLOCK_FIELDS = ['title', 'type', 'maker', 'origin', 'period', 'year', 'price', 'description', 'dimensions', 'images', 'status', 'featured'];

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

async function createClock(request, env) {
  const clock = validateClock(await readJson(request));
  const sql = `INSERT INTO clocks (${CLOCK_FIELDS.join(',')}) VALUES (${CLOCK_FIELDS.map(() => '?').join(',')}) RETURNING *`;
  const row = await env.DB.prepare(sql).bind(...CLOCK_FIELDS.map((f) => clock[f])).first();
  return json({ clock: rowToClock(row) }, 201);
}

async function updateClock(request, env, id) {
  const clock = validateClock(await readJson(request));
  const existing = await env.DB.prepare('SELECT images FROM clocks WHERE id = ?').bind(id).first();
  if (!existing) throw new HttpError(404, 'Clock not found');

  const sql = `UPDATE clocks SET ${CLOCK_FIELDS.map((f) => `${f} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? RETURNING *`;
  const row = await env.DB.prepare(sql).bind(...CLOCK_FIELDS.map((f) => clock[f]), id).first();

  // Remove photos that were taken off this listing
  const kept = new Set(safeJsonArray(clock.images));
  await deleteUploadedImages(env, safeJsonArray(existing.images).filter((u) => !kept.has(u)));

  return json({ clock: rowToClock(row) });
}

async function deleteClock(env, id) {
  const row = await env.DB.prepare('DELETE FROM clocks WHERE id = ? RETURNING images').bind(id).first();
  if (!row) throw new HttpError(404, 'Clock not found');
  await deleteUploadedImages(env, safeJsonArray(row.images));
  return json({ ok: true });
}

// ---------------------------------------------------------------- images (R2)

async function uploadImage(request, env) {
  const form = await request.formData().catch(() => null);
  const file = form && form.get('file');
  if (!file || typeof file === 'string') throw new HttpError(400, 'No file uploaded');
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new HttpError(400, 'Please upload a JPG, PNG, WebP or GIF image');
  if (file.size > MAX_IMAGE_BYTES) throw new HttpError(400, 'Image is too large (max 10 MB)');

  const key = `${crypto.randomUUID()}.${ext}`;
  await env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return json({ url: `/images/${key}` }, 201);
}

async function deleteUploadedImages(env, urls) {
  const keys = urls.filter((u) => u.startsWith('/images/')).map((u) => u.slice('/images/'.length));
  if (keys.length) await env.IMAGES.delete(keys);
}

async function serveImage(env, url) {
  const key = decodeURIComponent(url.pathname.slice('/images/'.length));
  if (!/^[\w-]+\.(jpg|png|webp|gif)$/.test(key)) return new Response('Not found', { status: 404 });
  const obj = await env.IMAGES.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
}

// ---------------------------------------------------------------- auth
//
// Single shared admin password (ADMIN_PASSWORD secret). On login we set an
// HttpOnly cookie "<expiry>.<hmac>" signed with SESSION_SECRET.

const encoder = new TextEncoder();

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function safeEqual(a, b) {
  // Compare digests so timing doesn't leak length or content
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(da, db);
}

function requireSecrets(env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    throw new HttpError(500, 'Admin login is not configured (set ADMIN_PASSWORD and SESSION_SECRET)');
  }
}

async function login(request, env) {
  requireSecrets(env);
  const { password } = await readJson(request);
  if (typeof password !== 'string' || !(await safeEqual(password, env.ADMIN_PASSWORD))) {
    throw new HttpError(401, 'Incorrect password');
  }
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = `${expires}.${await hmac(env.SESSION_SECRET, String(expires))}`;
  return json({ ok: true }, 200, {
    'set-cookie': `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`,
  });
}

function logout() {
  return json({ ok: true }, 200, {
    'set-cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  });
}

async function isLoggedIn(request, env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return false;
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return false;
  const [expires, sig] = match[1].split('.');
  if (!expires || !sig || Number(expires) < Date.now() / 1000) return false;
  return safeEqual(sig, await hmac(env.SESSION_SECRET, expires));
}

function checkSameOrigin(request, url) {
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) throw new HttpError(403, 'Cross-origin request blocked');
}
