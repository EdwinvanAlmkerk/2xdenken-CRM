-- Ontbrekende kolommen die de frontend wel gebruikte maar nog niet in de DB zaten.
-- Zonder deze kolommen faalde opslaan van een training met PGRST204.

ALTER TABLE trainingen
  ADD COLUMN IF NOT EXISTS duur           text  NULL,
  ADD COLUMN IF NOT EXISTS doelgroep      text  NULL,
  ADD COLUMN IF NOT EXISTS max_deelnemers text  NULL,
  ADD COLUMN IF NOT EXISTS tips           jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE uitvoeringen
  ADD COLUMN IF NOT EXISTS deelnemers    integer NULL,
  ADD COLUMN IF NOT EXISTS evaluatie     text    NULL,
  ADD COLUMN IF NOT EXISTS wat_ging_goed text    NULL,
  ADD COLUMN IF NOT EXISTS wat_kon_beter text    NULL;
