-- ── CONTACTEN: optioneel geboortedatum-veld ──────────────────────
-- Wordt gebruikt voor de "Verjaardagen"-widget op het dashboard.
ALTER TABLE contacten ADD COLUMN IF NOT EXISTS geboortedatum date;
