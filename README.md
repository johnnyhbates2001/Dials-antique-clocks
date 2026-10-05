# Dials Antique Clocks – website

A new website for Dials Antique Clocks (Lymington), built to run entirely on Cloudflare's free tier.

- **Homepage** – hero with a live clock face, guarantees, featured clocks, repairs, map and contact details
- **About & Repairs** – business story and the repair/restoration service
- **Shop** – every clock in stock, with filters for type, price, origin and "show sold", plus search and sorting. Filtered views have shareable URLs (e.g. `/shop?type=Longcase&maxPrice=5000`)
- **Clock pages** – photo gallery, description, specs and a call-to-enquire panel
- **Admin** (`/admin/`) – password login to add, edit and delete clocks, upload photos, mark clocks reserved/sold and choose which clocks appear on the homepage

## How it fits together

| Piece | Cloudflare product | Where |
| --- | --- | --- |
| Pages, CSS, JS | Workers static assets | `public/` |
| API + admin login | Worker | `src/worker.js` |
| Clock listings | D1 (SQLite) | `migrations/` |
| Uploaded photos | D1 (`images` table) | served at `/images/...` |

No framework and no build step. The pages are plain HTML, CSS and JavaScript, and the Worker is a single file.

### Design

The look borrows from a clock dial: enamel white background, Bodoni Moda headings (like the numerals painted on French dials), blued steel for buttons, links and prices, and a red seconds hand as the only accent. The colours are set as variables at the top of `public/css/styles.css`. The fonts (Bodoni Moda and Instrument Sans, both SIL Open Font License) are served from `public/fonts/`, so the site doesn't load anything from Google Fonts.

### API

Public:
- `GET /api/clocks`: list clocks. Query params: `type` (repeatable), `origin` (repeatable), `minPrice`, `maxPrice`, `q`, `sort` (`newest`, `price-asc`, `price-desc`, `age-asc`, `age-desc`), `includeSold=1`, `featured=1`
- `GET /api/clocks/:id`
- `GET /api/filters`: available types and origins, with counts

Admin (needs a login cookie):
- `POST /api/login`, `POST /api/logout`, `GET /api/session`
- `GET/POST /api/admin/clocks`, `GET/PUT/DELETE /api/admin/clocks/:id`
- `POST /api/admin/upload`: multipart `file`, returns `{ url }`

## Run it locally

```bash
npm install
cp .dev.vars.example .dev.vars      # sets the local admin password to "change-me"
npm run db:migrate:local
npm run db:seed:local               # sample clocks for the demo
npm run dev                         # http://localhost:8787
```

## Deploy to Cloudflare

```bash
npx wrangler login
npx wrangler d1 create dials-db                # copy the database_id into wrangler.jsonc
npm run db:migrate:remote
npm run db:seed:remote                         # optional: sample data for the demo
npx wrangler secret put ADMIN_PASSWORD         # the password the owners will use
npx wrangler secret put SESSION_SECRET         # any long random string, e.g. `openssl rand -hex 32`
npm run deploy
```

The site goes live at `https://dials-antique-clocks.<your-subdomain>.workers.dev`. To use their domain, add it under **Workers & Pages → dials-antique-clocks → Settings → Domains & Routes**. The domain's DNS has to be on Cloudflare first.

Everything runs on Cloudflare's free plan with no card needed. Photos are stored in D1, which limits each one to about 2 MB, so the admin shrinks them to 1600px before uploading. The free plan allows 500 MB per database, which is roughly 1,000–2,000 photos. If the shop outgrows that, move the photos to R2, Cloudflare's file storage. It needs a card on the account but has a 10 GB free allowance.

## Before going live

- [ ] Replace the **sample clocks** (`seed.sql`). Prices, dates and descriptions are placeholders, so delete them in the admin, or skip the seed step in production
- [ ] Replace the **About page** copy with the owners' own history (marked `PLACEHOLDER COPY` in `public/about.html`)
- [ ] Confirm **opening hours**, add an **email address** if they want one, and check the phone and address
- [ ] Add real **photos** of the shop and workshop. The homepage and about page use illustrations for now
- [ ] Decide whether they want an **enquiry form**. At the moment enquiries go by phone
