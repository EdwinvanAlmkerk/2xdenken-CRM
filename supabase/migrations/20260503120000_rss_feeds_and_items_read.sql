-- ── RSS-FEEDS (configureerbare feeds) ────────────────────────────
CREATE TABLE IF NOT EXISTS rss_feeds (
  id         text PRIMARY KEY,
  naam       text NOT NULL,
  url        text NOT NULL,
  categorie  text DEFAULT ''::text,
  sortering  integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ── RSS-ITEMS-READ (gelezen-status per item, cross-device) ───────
-- item_guid is uniek per feed; we slaan ook feed_url op zodat we
-- kunnen opruimen als een feed wordt verwijderd.
CREATE TABLE IF NOT EXISTS rss_items_read (
  id         text PRIMARY KEY,
  feed_id    text REFERENCES rss_feeds(id) ON DELETE CASCADE,
  item_guid  text NOT NULL,
  read_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rss_items_read_feed   ON rss_items_read(feed_id);
CREATE INDEX IF NOT EXISTS idx_rss_items_read_guid   ON rss_items_read(item_guid);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rss_items_read_feed_guid ON rss_items_read(feed_id, item_guid);
