-- ── Afschrijving op inkoopfacturen ──────────────────────────────
-- Voegt een afschrijvingsperiode (1–5 jaar) toe aan inkoopfacturen.
--
--   • 1 = niet afschrijven → volledig bedrag telt in het jaar van aankoop.
--   • 2–5 = het bedrag wordt in het kostenoverzicht gelijkmatig uitgesmeerd
--     over N jaar (bedrag / N per jaar, geboekt in de aankoopmaand van elk jaar).
--
-- De onderliggende factuur blijft ongewijzigd; alleen de weergave/analyse in
-- het kostenoverzicht smeert het bedrag uit over de afschrijvingsperiode.

ALTER TABLE inkoopfacturen
  ADD COLUMN IF NOT EXISTS afschrijvingsperiode smallint NOT NULL DEFAULT 1;

ALTER TABLE inkoopfacturen
  DROP CONSTRAINT IF EXISTS chk_inkoop_afschrijving;
ALTER TABLE inkoopfacturen
  ADD CONSTRAINT chk_inkoop_afschrijving
  CHECK (afschrijvingsperiode BETWEEN 1 AND 5);
