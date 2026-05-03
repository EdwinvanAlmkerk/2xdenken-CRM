-- Koppel een uitvoering (training op school) optioneel aan een contactpersoon.
ALTER TABLE uitvoeringen
  ADD COLUMN IF NOT EXISTS contact_id text NULL REFERENCES contacten(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_uitvoeringen_contact_id ON uitvoeringen(contact_id);
