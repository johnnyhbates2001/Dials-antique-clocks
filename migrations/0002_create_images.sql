-- Uploaded clock photos, stored in D1 so the site needs no other storage service.
-- D1 rows are capped at ~2 MB, so the admin shrinks photos before upload.
CREATE TABLE images (
  id           TEXT PRIMARY KEY,           -- e.g. "3f2c...e1.jpg", served at /images/<id>
  content_type TEXT NOT NULL,
  data         BLOB NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
