# Database migraties

Versie-gecontroleerd schema voor de 2xDenken CRM Supabase-database
(project: `ndgdhxznkazdilgioxpv`).

## Structuur

```
supabase/migrations/
├── baseline.sql                               ← volledig actueel schema (snapshot)
├── 20260417175454_uitvoeringen_add_contact_id.sql
├── 20260417182743_trainingen_uitvoeringen_missing_columns.sql
└── 20260417192736_dossiers_add_contact_id.sql
```

## `baseline.sql`

Bevat het **huidige** complete schema (alle kolommen, indexen, foreign keys).
Gebruik dit om een lege database in één keer op te zetten — bv. bij
lokale ontwikkeling of een nieuw Supabase-project:

```bash
psql $DATABASE_URL -f supabase/migrations/baseline.sql
```

Alle DDL gebruikt `IF NOT EXISTS`, dus meermaals uitvoeren is veilig.

## Genummerde migratiebestanden

Chronologische wijzigingen na de baseline. Timestamp-format
`YYYYMMDDHHMMSS` matcht de Supabase CLI-conventie en wordt
bijgehouden in `supabase_migrations.schema_migrations`.

Ook deze bestanden zijn idempotent (`ADD COLUMN IF NOT EXISTS`).

## Werkproces bij een nieuwe wijziging

1. Wijzig in Supabase Studio of via de Claude MCP-tool met een
   duidelijke migratienaam (`apply_migration`).
2. Maak een bestand aan: `supabase/migrations/<timestamp>_<naam>.sql`
   met dezelfde SQL (met `IF NOT EXISTS` / `IF EXISTS`).
3. Werk `baseline.sql` bij zodat die het nieuwe eindschema weerspiegelt
   (de baseline is geen replay-log, maar een snapshot).
4. Committen: migratiebestand + bijgewerkte baseline + frontend-aanpassingen
   in één logische commit.

## Waarom beide?

- **baseline.sql** = makkelijk lokaal testen / schone install.
- **losse migraties** = audit trail, zichtbaar welke stappen wanneer op de
  productie-DB zijn uitgevoerd.
