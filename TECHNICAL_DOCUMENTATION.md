# Technische Documentatie

## Projectnaam
2xDenken CRM

## Doel
Browser-gebaseerde CRM-applicatie voor het beheren van besturen, scholen, contacten, dossiers, facturen, trainingen en agenda-afspraken. De app is volledig statisch (HTML, CSS, vanilla JavaScript) en gebruikt Supabase als backend voor authenticatie, database (PostgREST) en bestandsopslag.

## Structuur

- `index.html` — enige HTML-pagina; bevat de login-schermen, app-shell en laadt alle CSS- en JS-bestanden.
- `css/`
  - `style.css` — alle styling voor login, sidebar, tabellen, modals, detailpagina's en kalenderweergaven (dag/week/maand).
- `js/`
  - `config.js` — Supabase URL en anon key.
  - `db.js` — in-memory `DB`-object, `supa()`/`supaAuth()` fetch-helpers, mapping-functies tussen snake_case (Supabase) en camelCase (frontend), en `loadAllData()`.
  - `auth.js` — login, logout en Enter-key handler. Automatisch sessie-herstel is uitgeschakeld.
  - `crud.js` — save- en delete-functies voor besturen, scholen, contacten, dossiers, facturen, trainingen, uitvoeringen en agenda-items richting Supabase.
  - `router.js` — navigatiestate (`page`, `pageParam`, `contactParam`), `navigate()`, `goBack()`, `renderNav()` en `renderContent()` dispatcher.
  - `utils.js` — SVG-iconen, formatters, Supabase Storage-helpers (bucket `dossier-bestanden`) en dossier-renderhelpers.
  - `ui.js` — loading-overlay, toasts, modals en exportfuncties.
  - `pages/`
    - `dashboard.js` — `renderDashboard()`; overzicht met KPI's en komende agenda-afspraken.
    - `agenda.js` — agendapagina met vier weergaven (dag, week, maand, lijst), navigatie (vorige/volgende/vandaag), filtering, zoekfunctie en context-aware afspraakmodal.
    - `besturen.js` — lijst en detailpagina van besturen; afspraak plannen vanuit dossiertab.
    - `scholen.js` — lijst en detailpagina van scholen, inclusief tabs; afspraak plannen vanuit dossier- en contactentab.
    - `contacten.js` — contactenoverzicht en `renderContactDetail()` met dossier-weergave; afspraak plannen vanuit contactdetail.
    - `trainingen.js` — trainingen/methodes lijst, detailpagina en uitvoeringen.
    - `facturen.js` — facturenoverzicht, filters en factuurmodal.
    - `instellingen.js` — instellingenpagina.
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
3. Na login roept `loadAllData()` in `db.js` parallel alle tabellen (inclusief `agenda`) op via PostgREST en mapt de rijen naar camelCase-objecten in het globale `DB`-object.
4. `router.js` beheert `page`, `pageParam` en `contactParam` en dispatcht naar de `render*`-functies in `js/pages/`. Navigatie verloopt via `navigate()` / `navigateToContact()` / `goBack()`.
5. Pagina-scripts renderen HTML-strings op basis van `DB` en koppelen `onclick`-handlers aan CRUD-functies in `crud.js`.
6. `crud.js` schrijft wijzigingen direct naar Supabase en werkt daarna `DB` bij, waarna `renderContent()` de UI ververst.
7. `utils.js` en `ui.js` leveren gedeelde hulpfuncties (iconen, formatters, modals, toasts, Storage-uploads).

## Recente functionaliteit

- **Dossier-items**: elk dossier-item heeft nu een `type` (`'notitie'` of `'bestand'`) en een verplicht `onderwerp`-veld. Optioneel kunnen er `bestanden` worden meegestuurd; deze worden geüpload naar de Supabase Storage-bucket `dossier-bestanden` (zie `js/utils.js`).
- **Contact-detailpagina**: contactpersonen hebben een eigen detailpagina (`contact-detail`, `renderContactDetail()` in `js/pages/contacten.js`) met een dossier-overzicht, bereikbaar door in de contactentabel op een naam te klikken.
- **Auth**: automatisch sessie-herstel is uitgeschakeld. Bij het laden van de pagina wordt een eventuele opgeslagen sessie uit `localStorage` verwijderd, zodat de gebruiker altijd expliciet op "Inloggen" moet klikken.
- **Agendamodule**: volledige agendafunctionaliteit met Supabase-tabel `agenda` (velden: `id`, `titel`, `datum`, `begin_tijd`, `eind_tijd`, `type`, `school_id`, `contact_id`, `bestuur_id`, `locatie`, `notitie`, `created_at`). Vijf afspraaktypes: afspraak, belafspraak, opvolging, training, overig. Vier weergaven: dagview, weekview (Outlook-achtig tijdrooster met uurblokken 07:00–21:00), maandview (kalenderraster) en lijstview. Navigatie met vorige/volgende en vandaag-knop. Kleurcodering per afspraaktype. Huidige-tijdlijn in dag- en weekview. Hele-dag items in aparte rij. Dashboard toont de eerstvolgende 5 afspraken.
- **Context-aware afspraken**: afspraken kunnen aangemaakt worden vanuit school-, bestuur- en contactdetailpagina's. De modal vult automatisch de relevante koppeling in (school/bestuur/contact) en toont bij school-context alleen contactpersonen van die school.

## Aanpassingen en updates

- Pas dit document aan bij iedere functionele of architecturale wijziging.
- Werk de secties "Structuur", "Belangrijkste bestanden", "Werking" en "Recente functionaliteit" bij als er iets verandert.
- Actualiseer de datum onder "Laatste update".

## Laatste update
- Datum: 2026-04-12
- Opmerking: Agendamodule uitgebreid met dag/week/maand-kalenderweergaven, navigatie, kleurcodering en context-aware afspraakmodal vanuit school-, bestuur- en contactdetailpagina's.
