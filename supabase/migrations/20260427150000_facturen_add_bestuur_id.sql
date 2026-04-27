-- Een factuur kan voortaan ook direct aan een bestuur hangen (zonder school).
-- school_id was al nullable. Voeg bestuur_id toe + index, en vul bestaande
-- rijen in vanuit het bestuur van de gekoppelde school.

ALTER TABLE facturen
  ADD COLUMN IF NOT EXISTS bestuur_id text REFERENCES besturen(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facturen_bestuur_id ON facturen(bestuur_id);

UPDATE facturen f
SET bestuur_id = s.bestuur_id
FROM scholen s
WHERE f.school_id = s.id
  AND f.bestuur_id IS NULL
  AND s.bestuur_id IS NOT NULL;
