-- ── TAKENMODULE — Taken + Taaktypes ─────────────────────────────
-- Taken met een deadline en optioneel een inplan-moment (uitvoerdatum +
-- tijd) dat in de agenda verschijnt. Taken kunnen optioneel aan een
-- contactpersoon/school gekoppeld worden (→ zichtbaar in het dossier).
-- Het soort taak (Bellen, Todo, …) is beheerbaar in Instellingen.
-- Patroon identiek aan de kostenmodule (kosten_types).

-- ── Taaktypes ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taak_types (
  id         text PRIMARY KEY,
  naam       text NOT NULL,
  kleur      text DEFAULT 'navy'::text,
  created_at timestamptz DEFAULT now()
);

INSERT INTO taak_types (id, naam, kleur)
VALUES
  ('bellen',   'Bellen',    'blauw'),
  ('todo',     'To-do',     'navy'),
  ('mailen',   'Mailen',    'oranje'),
  ('afspraak', 'Afspraak',  'paars'),
  ('overig',   'Overig',    'grijs')
ON CONFLICT (id) DO NOTHING;

-- ── Taken ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taken (
  id              text PRIMARY KEY,
  onderwerp       text NOT NULL,
  tekst           text DEFAULT ''::text,
  taak_type_id    text REFERENCES taak_types(id) ON DELETE SET NULL,
  deadline        date,
  plan_datum      date,
  plan_begin_tijd time,
  plan_eind_tijd  time,
  status          text NOT NULL DEFAULT 'open',
  afgerond_op     timestamptz,
  school_id       text REFERENCES scholen(id)   ON DELETE SET NULL,
  contact_id      text REFERENCES contacten(id) ON DELETE SET NULL,
  bestuur_id      text REFERENCES besturen(id)  ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

-- Veelgebruikte filters: deadline (dashboard/sort), plan_datum (agenda),
-- koppelingen (dossier/detailpagina's), status (open/afgerond).
CREATE INDEX IF NOT EXISTS idx_taken_deadline   ON taken (deadline);
CREATE INDEX IF NOT EXISTS idx_taken_plan_datum ON taken (plan_datum);
CREATE INDEX IF NOT EXISTS idx_taken_contact_id ON taken (contact_id);
CREATE INDEX IF NOT EXISTS idx_taken_school_id  ON taken (school_id);
CREATE INDEX IF NOT EXISTS idx_taken_status     ON taken (status);

-- ── Permissies (zelfde aanpak als de kostenmodule) ──────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.taak_types TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.taken      TO anon, authenticated;

ALTER TABLE public.taak_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.taken      DISABLE ROW LEVEL SECURITY;
