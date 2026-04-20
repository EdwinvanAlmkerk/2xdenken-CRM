-- Voeg documentopslag toe aan trainingen zodat hand-outs, PDF's en andere bestanden
-- direct aan een training of werkvorm gekoppeld kunnen worden.

ALTER TABLE trainingen
  ADD COLUMN IF NOT EXISTS bestanden jsonb NOT NULL DEFAULT '[]'::jsonb;
