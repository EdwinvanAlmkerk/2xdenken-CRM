-- ═══════════════════════════════════════════════════════════════════
--  2xDenken CRM — baseline schema
--  Snapshot van het actuele schema op 2026-04-17
--  Idempotent: veilig om meermaals uit te voeren.
-- ═══════════════════════════════════════════════════════════════════

-- ── BESTUREN ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS besturen (
  id         text PRIMARY KEY,
  naam       text NOT NULL,
  website    text DEFAULT ''::text,
  adres      text DEFAULT ''::text,
  created_at timestamptz DEFAULT now()
);

-- ── SCHOLEN ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scholen (
  id         text PRIMARY KEY,
  naam       text NOT NULL,
  bestuur_id text REFERENCES besturen(id) ON DELETE SET NULL,
  debiteurnr text DEFAULT ''::text,
  adres      text DEFAULT ''::text,
  postcode   text DEFAULT ''::text,
  plaats     text DEFAULT ''::text,
  website    text DEFAULT ''::text,
  created_at timestamptz DEFAULT now()
);

-- ── CONTACTEN ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacten (
  id         text PRIMARY KEY,
  school_id  text REFERENCES scholen(id) ON DELETE CASCADE,
  naam       text NOT NULL,
  functie    text DEFAULT ''::text,
  type       text DEFAULT 'beslisser'::text,
  email      text DEFAULT ''::text,
  telefoon   text DEFAULT ''::text,
  created_at timestamptz DEFAULT now()
);

-- ── DOSSIERS (notities + bestanden) ───────────────────────────────
CREATE TABLE IF NOT EXISTS dossiers (
  id         text PRIMARY KEY,
  school_id  text REFERENCES scholen(id) ON DELETE CASCADE,
  contact_id text REFERENCES contacten(id) ON DELETE SET NULL,
  datum      text DEFAULT ''::text,
  type       text,
  onderwerp  text,
  tekst      text DEFAULT ''::text,
  bron_naam  text DEFAULT ''::text,
  bestanden  jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dossiers_contact_id ON dossiers(contact_id);

-- ── TRAININGEN / METHODES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trainingen (
  id             text PRIMARY KEY,
  naam           text NOT NULL,
  categorie      text DEFAULT ''::text,
  duur           text,
  doelgroep      text,
  max_deelnemers text,
  omschrijving   text DEFAULT ''::text,
  tips           jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at     timestamptz DEFAULT now()
);

-- ── UITVOERINGEN (training × school × contact) ────────────────────
CREATE TABLE IF NOT EXISTS uitvoeringen (
  id             text PRIMARY KEY,
  training_id    text REFERENCES trainingen(id) ON DELETE CASCADE,
  school_id      text REFERENCES scholen(id)    ON DELETE CASCADE,
  contact_id     text REFERENCES contacten(id)  ON DELETE SET NULL,
  datum          text DEFAULT ''::text,
  deelnemers     integer,
  score          integer DEFAULT 0,
  evaluatie      text,
  wat_ging_goed  text,
  wat_kon_beter  text,
  notities       text DEFAULT ''::text,
  tips           text DEFAULT ''::text,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uitvoeringen_contact_id  ON uitvoeringen(contact_id);
CREATE INDEX IF NOT EXISTS idx_uitvoeringen_school_id   ON uitvoeringen(school_id);
CREATE INDEX IF NOT EXISTS idx_uitvoeringen_training_id ON uitvoeringen(training_id);

-- ── FACTUREN ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturen (
  id          text PRIMARY KEY,
  school_id   text REFERENCES scholen(id)   ON DELETE SET NULL,
  contact_id  text REFERENCES contacten(id) ON DELETE SET NULL,
  nummer      text NOT NULL,
  debiteurnr  text DEFAULT ''::text,
  tav         text DEFAULT ''::text,
  datum       text DEFAULT ''::text,
  vervaldatum text DEFAULT ''::text,
  status      text DEFAULT 'verzonden'::text,
  betreft     text DEFAULT ''::text,
  totaal      numeric DEFAULT 0,
  regels      jsonb   DEFAULT '[]'::jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS factuur_regels (
  id           text PRIMARY KEY,
  factuur_id   text REFERENCES facturen(id) ON DELETE CASCADE,
  omschrijving text DEFAULT ''::text,
  toelichting  text DEFAULT ''::text,
  datum        text DEFAULT ''::text,
  uren         text DEFAULT ''::text,
  bedrag       numeric DEFAULT 0,
  volgorde     integer DEFAULT 0
);

-- ── AGENDA ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agenda (
  id         text PRIMARY KEY,
  titel      text NOT NULL,
  datum      date NOT NULL,
  begin_tijd time,
  eind_tijd  time,
  type       text DEFAULT 'afspraak'::text,
  school_id  text REFERENCES scholen(id)   ON DELETE SET NULL,
  contact_id text REFERENCES contacten(id) ON DELETE SET NULL,
  bestuur_id text REFERENCES besturen(id)  ON DELETE SET NULL,
  locatie    text,
  notitie    text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agenda_types (
  id    text PRIMARY KEY,
  naam  text NOT NULL,
  kleur text DEFAULT 'navy'::text
);

CREATE TABLE IF NOT EXISTS training_types (
  id         text PRIMARY KEY,
  naam       text NOT NULL,
  kleur      text DEFAULT 'navy'::text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_categories (
  id         text PRIMARY KEY,
  naam       text NOT NULL,
  kleur      text DEFAULT 'navy'::text,
  created_at timestamptz DEFAULT now()
);

-- ── EMAIL ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
  id         text PRIMARY KEY,
  naam       text NOT NULL,
  onderwerp  text NOT NULL DEFAULT ''::text,
  body       text NOT NULL DEFAULT ''::text,
  categorie  text DEFAULT 'algemeen'::text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_log (
  id          text PRIMARY KEY,
  template_id text,
  school_id   text REFERENCES scholen(id)   ON DELETE SET NULL,
  contact_id  text REFERENCES contacten(id) ON DELETE SET NULL,
  factuur_id  text,
  aan_email   text NOT NULL,
  aan_naam    text,
  onderwerp   text NOT NULL DEFAULT ''::text,
  body        text NOT NULL DEFAULT ''::text,
  status      text DEFAULT 'verzonden'::text,
  datum       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_settings (
  id         text PRIMARY KEY DEFAULT 'main'::text,
  imap_host  text,
  imap_port  integer DEFAULT 993,
  smtp_host  text,
  smtp_port  integer DEFAULT 587,
  email_user text,
  email_pass text,
  email_from text,
  signature  text DEFAULT ''::text,
  updated_at timestamptz DEFAULT now()
);

-- ── OUTLOOK .ics FEED ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outlook_settings (
  id            text PRIMARY KEY,
  ics_url       text,
  days_past     integer DEFAULT 30,
  days_future   integer DEFAULT 180,
  calendar_name text,
  updated_at    timestamptz DEFAULT now()
);
