-- Instelbare trainingtypes voor de trainingen-module.
-- Deze types zijn beheerbaar via Instellingen en worden gebruikt in het
-- aanmaak-/bewerkformulier van trainingen.

CREATE TABLE IF NOT EXISTS training_types (
  id         text PRIMARY KEY,
  naam       text NOT NULL,
  kleur      text DEFAULT 'navy'::text,
  created_at timestamptz DEFAULT now()
);

INSERT INTO training_types (id, naam, kleur)
VALUES
  ('training', 'Training', 'oranje'),
  ('coaching', 'Coaching', 'navy'),
  ('methode', 'Methode', 'groen'),
  ('workshop', 'Workshop', 'goud'),
  ('advies', 'Advies', 'blauw'),
  ('anders', 'Anders', 'paars')
ON CONFLICT (id) DO NOTHING;
