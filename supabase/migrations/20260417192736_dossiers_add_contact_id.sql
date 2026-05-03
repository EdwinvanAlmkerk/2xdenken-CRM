-- Koppel een dossierregel (notitie of bestand) ook persistently aan
-- een contactpersoon. De frontend ondersteunde dit al, maar de kolom
-- ontbrak waardoor de link na een refresh verloren ging.

ALTER TABLE dossiers
  ADD COLUMN IF NOT EXISTS contact_id text NULL REFERENCES contacten(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dossiers_contact_id ON dossiers(contact_id);
