-- Clock listings shown on the shop page
CREATE TABLE clocks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  type        TEXT    NOT NULL,             -- Longcase, Bracket, Mantel, Wall, Carriage, Skeleton, ...
  maker       TEXT,
  origin      TEXT,                         -- English, French, ...
  period      TEXT,                         -- free text, e.g. "c. 1780"
  year        INTEGER,                      -- approximate year, used for sorting/filtering
  price       INTEGER,                      -- whole pounds; NULL = price on request
  description TEXT    NOT NULL DEFAULT '',
  dimensions  TEXT,
  images      TEXT    NOT NULL DEFAULT '[]',-- JSON array of image URLs
  status      TEXT    NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold')),
  featured    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_clocks_status ON clocks (status);
CREATE INDEX idx_clocks_type   ON clocks (type);
CREATE INDEX idx_clocks_price  ON clocks (price);
