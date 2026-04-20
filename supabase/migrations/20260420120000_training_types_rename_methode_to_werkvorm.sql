-- Hernoem het trainingtype 'methode' naar 'werkvorm'. De UI toont nu
-- overal "werkvorm(en)" in plaats van "methode(s)"; zowel de primaire
-- sleutel in training_types als de verwijzende kolommen op trainingen
-- worden meegenomen.

-- 1. Update bestaande trainingen die naar het oude type/categorie wezen.
UPDATE trainingen SET type       = 'werkvorm' WHERE type       = 'methode';
UPDATE trainingen SET categorie  = 'werkvorm' WHERE categorie  = 'methode';

-- 2. Zorg dat het nieuwe type bestaat, en ruim het oude op.
INSERT INTO training_types (id, naam, kleur)
VALUES ('werkvorm', 'Werkvorm', 'groen')
ON CONFLICT (id) DO UPDATE SET naam = EXCLUDED.naam, kleur = EXCLUDED.kleur;

DELETE FROM training_types WHERE id = 'methode';
