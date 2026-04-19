-- Instelbare trainingscategorieën voor de trainingen-module.
-- Deze categorieën zijn beheerbaar via Instellingen en worden gebruikt
-- naast het trainingtype in het aanmaak-/bewerkformulier van trainingen.

CREATE TABLE IF NOT EXISTS training_categories (
  id         text PRIMARY KEY,
  naam       text NOT NULL,
  kleur      text DEFAULT 'navy'::text,
  created_at timestamptz DEFAULT now()
);

INSERT INTO training_categories (id, naam, kleur)
VALUES
  ('algemeen', 'Algemeen', 'navy'),
  ('didactiek', 'Didactiek', 'blauw'),
  ('gedrag', 'Gedrag', 'oranje'),
  ('team', 'Team', 'groen'),
  ('ouders', 'Ouders', 'paars'),
  ('maatwerk', 'Maatwerk', 'goud')
ON CONFLICT (id) DO NOTHING;
