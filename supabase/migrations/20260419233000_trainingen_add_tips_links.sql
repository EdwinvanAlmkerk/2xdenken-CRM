-- Sla één of meerdere externe links per training/methode op.
ALTER TABLE trainingen
  ADD COLUMN IF NOT EXISTS tips_links jsonb NOT NULL DEFAULT '[]'::jsonb;
