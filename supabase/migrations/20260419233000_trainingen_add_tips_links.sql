-- Sla één of meerdere externe links per training/werkvorm op.
ALTER TABLE trainingen
  ADD COLUMN IF NOT EXISTS tips_links jsonb NOT NULL DEFAULT '[]'::jsonb;
