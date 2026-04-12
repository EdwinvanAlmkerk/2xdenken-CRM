# Technische Documentatie

## Projectnaam
2xDenken CRM

## Doel
Browser-gebaseerde CRM-applicatie voor het beheren van besturen, scholen, contacten, dossiers, facturen, trainingen en agenda-afspraken. De app is volledig statisch (HTML, CSS, vanilla JavaScript) en gebruikt Supabase als backend voor authenticatie, database (PostgREST) en bestandsopslag.

## Structuur

- `index.html` — enige HTML-pagina; bevat de login-schermen, app-shell en laadt alle CSS- en JS-bestanden.
- `css/`
  - `style.css` — fris licht thema met glaskaarten op lichte achtergrond; donkerblauwe sidebar. Font: Outfit. Subtiele mesh-achtergrond met radiale gradiënten. Glass-effecten met `backdrop-filter: blur()`.
- `js/`
  - `config.js` — Supabase URL en anon key.
  - `db.js` — in-memory `DB`-object, `supa()`/`supaAuth()` fetch-helpers, mapping-functies tussen snake_case (Supabase) en camelCase (frontend), en `loadAllData()`.
  - `auth.js` — login, logout en Enter-key handler. Automatisch sessie-herstel is uitgeschakeld.
  - `crud.js` — save- en delete-functies voor besturen, scholen, contacten, dossiers, facturen, trainingen, uitvoeringen, agenda-items, agendatypes en e-mailtemplates richting Supabase.
  - `email.js` — e-mail compose module: template-variabelen invullen (`resolveTemplateVars`), compose modal (`openEmailModal`), mailto-link genereren, concepten opslaan/bewerken, doorsturen, automatische dossiernotitie en email_log bij verzending.
  - `router.js` — navigatiestate (`page`, `pageParam`, `contactParam`), `navigate()`, `goBack()`, `renderNav()` en `renderContent()` dispatcher.
  - `utils.js` — SVG-iconen, formatters, Supabase Storage-helpers (bucket `dossier-bestanden`) en dossier-renderhelpers.
  - `ui.js` — loading-overlay, toasts, modals en exportfuncties.
  - `pages/`
    - `dashboard.js` — `renderDashboard()`; overzicht met KPI's en komende agenda-afspraken.
    - `email-page.js` — e-mailpagina met mappenstructuur (Verzonden, Concepten), berichtenlijst en detailweergave.
    - `agenda.js` — agendapagina met vier weergaven (dag, week, maand, lijst), navigatie (vorige/volgende/vandaag), filtering, zoekfunctie en context-aware afspraakmodal.
    - `besturen.js` — lijst en detailpagina van besturen met tabs (Scholen, Dossier, Agenda).
    - `scholen.js` — lijst en detailpagina van scholen met tabs (Overzicht, Contacten, Dossier, Agenda, Trainingen, Facturen).
    - `contacten.js` — contactenoverzicht en `renderContactDetail()` met agenda-kaart en dossier-weergave.
    - `trainingen.js` — trainingen/methodes lijst, detailpagina en uitvoeringen.
    - `facturen.js` — facturenoverzicht, filters en factuurmodal.
    - `instellingen.js` — instellingenpagina met beheer van agendatypes en e-mailtemplates, plus database-onderhoud.
- `TECHNICAL_DOCUMENTATION.md` — dit document.

## Technische stack

- HTML, CSS, vanilla JavaScript (geen build-step, geen framework).
- Supabase (PostgREST REST API, Auth en Storage) als backend.
- Hosting: GitHub Pages op https://edwinvanalmkerk.github.io/2xdenken-CRM/, branch `main`.

## Belangrijkste bestanden

- `js/config.js` — Supabase-endpoint en anon key.
- `js/db.js` — centrale datalaag, fetch-helpers en mapping tussen Supabase-rijen en frontend-objecten.
- `js/auth.js` — afhandeling van login/logout via `supaAuth()`; sessie wordt niet automatisch hersteld.
- `js/crud.js` — alle schrijfacties (POST/PATCH/DELETE) naar Supabase en bijwerken van de in-memory `DB`.
- `js/router.js` — bepaalt actieve pagina en roept de juiste `render*`-functie aan.
- `js/utils.js` — iconen, datum- en bedragformatters, Supabase Storage-uploads voor dossier-bestanden.
- `js/ui.js` — modals, toasts, loading-indicator en exports.
- `js/pages/*.js` — per module de render- en interactielogica van een pagina.

## Werking

1. `index.html` toont eerst het login-scherm; pas na een geslaagde `doLogin()` wordt de app-shell zichtbaar.
2. `auth.js` stuurt credentials naar `/auth/v1/token?grant_type=password` via `supaAuth()` en bewaart de sessie in `currentSession`. Er is geen automatisch herstel bij paginalaad; oude sessies worden juist gewist.
3. Na login roept `loadAllData()` in `db.js` parallel alle tabellen (inclusief `agenda`, `agenda_types` en `email_templates`) op via PostgREST en mapt de rijen naar camelCase-objecten in het globale `DB`-object.
4. `router.js` beheert `page`, `pageParam` en `contactParam` en dispatcht naar de `render*`-functies in `js/pages/`. Navigatie verloopt via `navigate()` / `navigateToContact()` / `goBack()`.
5. Pagina-scripts renderen HTML-strings op basis van `DB` en koppelen `onclick`-handlers aan CRUD-functies in `crud.js`.
6. `crud.js` schrijft wijzigingen direct naar Supabase en werkt daarna `DB` bij, waarna `renderContent()` de UI ververst.
7. `utils.js` en `ui.js` leveren gedeelde hulpfuncties (iconen, formatters, modals, toasts, Storage-uploads).

## Recente functionaliteit

- **Dossier-items**: elk dossier-item heeft nu een `type` (`'notitie'` of `'bestand'`) en een verplicht `onderwerp`-veld. Optioneel kunnen er `bestanden` worden meegestuurd; deze worden geüpload naar de Supabase Storage-bucket `dossier-bestanden` (zie `js/utils.js`).
- **Contact-detailpagina**: contactpersonen hebben een eigen detailpagina (`contact-detail`, `renderContactDetail()` in `js/pages/contacten.js`) met een dossier-overzicht, bereikbaar door in de contactentabel op een naam te klikken.
- **Auth**: automatisch sessie-herstel is uitgeschakeld. Bij het laden van de pagina wordt een eventuele opgeslagen sessie uit `localStorage` verwijderd, zodat de gebruiker altijd expliciet op "Inloggen" moet klikken.
- **Agendamodule**: volledige agendafunctionaliteit met Supabase-tabel `agenda` (velden: `id`, `titel`, `datum`, `begin_tijd`, `eind_tijd`, `type`, `school_id`, `contact_id`, `bestuur_id`, `locatie`, `notitie`, `created_at`). Vier weergaven: dagview, weekview (Outlook-achtig tijdrooster met uurblokken 07:00–21:00), maandview (kalenderraster) en lijstview. Navigatie met vorige/volgende en vandaag-knop. Kleurcodering per afspraaktype. Huidige-tijdlijn in dag- en weekview. Hele-dag items in aparte rij. Dashboard toont de eerstvolgende 5 afspraken.
- **Dynamische agendatypes**: agendatypes worden opgeslagen in Supabase-tabel `agenda_types` (velden: `id`, `naam`, `kleur`). Beheerbaar via Instellingen: aanmaken, bewerken en verwijderen met 7 kleuropties (navy, paars, blauw, groen, goud, rood, oranje). Standaard 5 types meegeleverd.
- **E-mailmodule**: eigen pagina in sidebar met mappenstructuur (Verzonden, Concepten). Supabase-tabellen `email_templates` en `email_log`. Templates ondersteunen variabelen (`{{contactnaam}}`, `{{factuurnummer}}`, etc.). Compose-modal met template-keuze, contactselectie, concept opslaan en mailto-verzending. Doorsturen van eerder verzonden berichten. Automatische dossiernotitie + email_log bij verzending. E-mail knoppen op contactdetail, schooldetail en factuuroverzicht.
- **Agenda-integratie in detailpagina's**: scholen en besturen hebben een eigen "Agenda"-tab die afspraken gekoppeld aan die entiteit toont (komend/verlopen). Contactdetailpagina toont een agenda-kaart boven het dossier. Afspraken aanmaken vanuit deze pagina's vult automatisch de koppeling in; bij school-context worden alleen contactpersonen van die school getoond en het bestuur automatisch afgeleid.

## Aanpassingen en updates

- Pas dit document aan bij iedere functionele of architecturale wijziging.
- Werk de secties "Structuur", "Belangrijkste bestanden", "Werking" en "Recente functionaliteit" bij als er iets verandert.
- Actualiseer de datum onder "Laatste update".

## Laatste update
- Datum: 2026-04-12
- Opmerking: E-mailmodule fase 1 (templates, compose modal, mailto, auto-log). Visuele redesign naar fris licht thema (Outfit font, witte glaskaarten, donkerblauwe sidebar, mesh-achtergrond, accent-kleuren teal/paars/oranje). Alle bestaande functionaliteit ongewijzigd.
