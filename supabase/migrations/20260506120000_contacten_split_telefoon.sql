-- ── CONTACTEN: telefoon splitsen in mobiel en werk ───────────────
-- Bestaande `telefoon` wordt overgenomen in `telefoon_mobiel`. De oude
-- kolom blijft staan als backup; de frontend gebruikt deze niet meer.
ALTER TABLE contacten ADD COLUMN IF NOT EXISTS telefoon_mobiel text DEFAULT ''::text;
ALTER TABLE contacten ADD COLUMN IF NOT EXISTS telefoon_werk   text DEFAULT ''::text;

UPDATE contacten
   SET telefoon_mobiel = telefoon
 WHERE COALESCE(telefoon_mobiel, '') = ''
   AND COALESCE(telefoon, '') <> '';
