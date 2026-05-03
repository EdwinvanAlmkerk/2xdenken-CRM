# 2xDenken CRM — Werkinstructies voor Claude

## Project
Browser-gebaseerde CRM-app (statische HTML/CSS/JS) met Supabase als backend. Gehost via GitHub Pages op https://edwinvanalmkerk.github.io/2xdenken-CRM/. Hoofdbranch: `main`.

## Documentatie automatisch bijwerken

**Na elke functionele wijziging aan de CRM-code** (bestanden in `js/`, `css/`, `index.html`) moet je de `doc-updater` subagent aanroepen vóór je de taak als klaar beschouwt.

Richtlijn:
- Triviale fixes (typo, kleur, tekst) → niet nodig.
- Nieuwe features, gewijzigde data-flow, nieuwe bestanden, veranderde architectuur, schema-wijzigingen → **wel** aanroepen.
- Bij twijfel: aanroepen.

Gebruik:
```
Agent(subagent_type: "doc-updater", description: "Docs bijwerken", prompt: "Werk TECHNICAL_DOCUMENTATION.md bij. Recente wijziging: <korte beschrijving van wat er veranderd is in deze sessie>.")
```

Na de agent-run: controleer de diff kort en vermeld in je eindrapport aan de gebruiker dat de docs zijn bijgewerkt.

## Git-werkwijze

- Commit alleen wanneer de gebruiker daar expliciet om vraagt.
- Push alleen naar `main`.
- Commit-berichten in het Nederlands, beknopt, focus op het "waarom".
