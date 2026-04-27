-- Voeg een debiteurnummer toe aan besturen, zichtbaar in het overzicht
-- en bewerkbaar via de bestuur-modal.
ALTER TABLE besturen
  ADD COLUMN IF NOT EXISTS debiteurnr text;
