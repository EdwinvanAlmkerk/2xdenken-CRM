-- ── DASHBOARD-INSTELLINGEN ────────────────────────────────────────
-- Single-row tabel (id='main') die de zichtbare/verborgen widgets en
-- hun volgorde bewaart. `widgets` is een JSON-array van
-- { id: <widget-key>, visible: <bool> } objecten in gewenste volgorde.
CREATE TABLE IF NOT EXISTS dashboard_settings (
  id         text PRIMARY KEY,
  widgets    jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);
