-- ── AGENDA-FEED — Geheime token voor publiek webcal/ICS-abonnement ──
-- De edge function `agenda-feed` publiceert agenda-afspraken + ingeplande
-- taken als een text/calendar-feed waar een iPhone (of andere agenda-app)
-- zich op kan abonneren. De feed is beveiligd met een geheime token in de
-- URL (?token=…); deze tabel bewaart die token (single-row id='main').

CREATE TABLE IF NOT EXISTS feed_settings (
  id         text PRIMARY KEY DEFAULT 'main',
  token      text NOT NULL,
  created_at timestamptz DEFAULT now()
);

INSERT INTO feed_settings (id, token)
VALUES ('main', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON TABLE public.feed_settings TO anon, authenticated;
ALTER TABLE public.feed_settings DISABLE ROW LEVEL SECURITY;
