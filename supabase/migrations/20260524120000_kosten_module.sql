-- ── KOSTENMODULE — Inkoopfacturen + Kostentypes ─────────────────
-- Twee nieuwe tabellen voor het beheren van inkoopfacturen (uitgaven)
-- met een eigen, in Instellingen beheerbaar lijstje kostentypes.
-- Inkoopfacturen kunnen terugkerend zijn (template + automatisch
-- gegenereerde child-records via parent_id self-FK).

-- ── Kostentypes ─────────────────────────────────────────────────
-- Pattern: identiek aan training_types / training_categories.
CREATE TABLE IF NOT EXISTS kosten_types (
  id         text PRIMARY KEY,
  naam       text NOT NULL,
  kleur      text DEFAULT 'navy'::text,
  created_at timestamptz DEFAULT now()
);

INSERT INTO kosten_types (id, naam, kleur)
VALUES
  ('reiskosten',  'Reiskosten',         'blauw'),
  ('materiaal',   'Materiaal',          'oranje'),
  ('software',    'Software & licenties','navy'),
  ('locatie',     'Locatiehuur',        'paars'),
  ('overig',      'Overig',             'grijs')
ON CONFLICT (id) DO NOTHING;

-- ── Inkoopfacturen ──────────────────────────────────────────────
-- Eén tabel die zowel losse inkopen als recurring "templates" en hun
-- automatisch gegenereerde children huisvest.
--
--   • is_recurring=true  + parent_id IS NULL  → template (telt zelf ook mee)
--   • is_recurring=false + parent_id IS NULL  → losse inkoop
--   • is_recurring=false + parent_id NOT NULL → child van een template
--
-- Bij het verwijderen van een template blijven children bestaan (parent_id
-- wordt NULL gezet) zodat financiële historie niet wegvalt.
CREATE TABLE IF NOT EXISTS inkoopfacturen (
  id                  uuid PRIMARY KEY,
  factuurnummer       text,
  leverancier         text NOT NULL,
  kosten_type_id      text REFERENCES kosten_types(id) ON DELETE SET NULL,
  factuurdatum        date NOT NULL,
  omschrijving        text,
  bedrag              numeric(12, 2) NOT NULL DEFAULT 0,
  is_recurring        boolean NOT NULL DEFAULT false,
  recurring_interval  text,
  recurring_end_date  date,
  parent_id           uuid REFERENCES inkoopfacturen(id) ON DELETE SET NULL,
  bestanden           jsonb NOT NULL DEFAULT '[]'::jsonb,
  notitie             text,
  created_at          timestamptz DEFAULT now()
);

-- Voorkomt dubbele auto-gegenereerde children bij race conditions
-- (meerdere tabs / parallelle generators).
CREATE UNIQUE INDEX IF NOT EXISTS uq_inkoopfacturen_parent_datum
  ON inkoopfacturen (parent_id, factuurdatum)
  WHERE parent_id IS NOT NULL;

-- Veelgebruikte filters: datum (overzicht/sort), type (filter), parent (recurring).
CREATE INDEX IF NOT EXISTS idx_inkoopfacturen_factuurdatum ON inkoopfacturen (factuurdatum DESC);
CREATE INDEX IF NOT EXISTS idx_inkoopfacturen_kosten_type  ON inkoopfacturen (kosten_type_id);
CREATE INDEX IF NOT EXISTS idx_inkoopfacturen_parent       ON inkoopfacturen (parent_id);
