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
  - `utils.js` — SVG-iconen, formatters, Supabase Storage-helpers (bucket `dossier-bestanden`), dossier-renderhelpers en globale zoekfunctie.
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
- `supabase/functions/`
  - `fetch-emails/index.ts` — Deno Edge Function die IMAP-berichten ophaalt (headers of volledige body per UID) voor Inbox en Verwijderde items (folder-alias `__trash__` die taal-afhankelijk de juiste Trash-map oplost).
  - `send-email/index.ts` — Deno Edge Function die mails via SMTP verzendt.
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
- **E-mailmodule**: eigen pagina in sidebar met mappenstructuur (Inbox, Verzonden, Concepten, Verwijderde items). IMAP/SMTP-serverinstellingen configureerbaar via Instellingen (Supabase-tabel `email_settings`). Inbox en Verwijderde items worden opgehaald via de Edge Function `fetch-emails` (IMAP); Verwijderde items gebruikt de alias-folder `__trash__` die server-side via `ImapClient.selectTrash()` taal-afhankelijk wordt opgelost door een lijst kandidaat-mapnamen te proberen (`[Gmail]/Trash`, `[Gmail]/Prullenbak`, `[Gmail]/Bin`, `Trash`, `Prullenbak`, `Deleted Messages`, `Deleted Items`). `ImapClient.select()` gooit nu een error bij een NO/BAD response in plaats van stil te falen. Direct verzenden via SMTP Edge Function met fallback naar mailto. Factuur-PDF als bijlage bij factuur-emails via html2pdf.js. E-mailhandtekening configureerbaar via Opties. Supabase-tabellen `email_templates` en `email_log`. Templates ondersteunen variabelen (`{{contactnaam}}`, `{{factuurnummer}}`, etc.). Compose-modal met template-keuze, contactselectie, concept opslaan en mailto-verzending. Doorsturen van eerder verzonden berichten. Automatische dossiernotitie + email_log bij verzending. E-mail knoppen op contactdetail, schooldetail en factuuroverzicht.
- **E-mail performance (stale-while-revalidate)**: Inbox en Verwijderde items worden gecached in `localStorage` onder de sleutels `_crm_inbox_cache_v1` en `_crm_trash_cache_v1` via de helpers `_loadMailCache(key)` en `_saveMailCache(key, messages)` in `js/pages/email-page.js`. Bij het openen van de e-mailmodule worden gecachte berichten direct getoond terwijl er op de achtergrond een verse fetch loopt. De state-flags `_inboxFetchedOnce` en `_trashFetchedOnce` zorgen dat de auto-fetch maar één keer per sessie triggert, ook als de berichten-array al vanuit cache is gevuld. `renderEmailPage()` rendert meteen de volledige shell (sidebar, toolbar, kolomheaders) zonder blocker loading-pagina; een loading-state in de berichtenlijst verschijnt alleen als `items.length === 0`. De refresh-knop in de toolbar toont een inline mini-spinner tijdens vernieuwen. Fetch-limit is verlaagd naar 20 berichten per map voor een snellere cold start. Bij een fetch-error blijven gecachte berichten zichtbaar in plaats van terug te vallen op een lege lijst.
- **Agenda-integratie in detailpagina's**: scholen en besturen hebben een eigen "Agenda"-tab die afspraken gekoppeld aan die entiteit toont (komend/verlopen). Contactdetailpagina toont een agenda-kaart boven het dossier. Afspraken aanmaken vanuit deze pagina's vult automatisch de koppeling in; bij school-context worden alleen contactpersonen van die school getoond en het bestuur automatisch afgeleid.
- **Globale zoekbalk**: de zoekbalk in de topbar (`index.html`, search-wrap, breedte 360px) doorzoekt scholen, besturen, contacten, facturen, trainingen en agenda-items (titel en locatie). Resultaten worden gegroepeerd per type met een group-label en maximaal 5 hits per groep. Scoring via `_searchScore` in `js/utils.js` (exact=100, startsWith=60, wordStart=40, includes=20) sorteert de beste match bovenaan. Matches worden gehighlight met `_highlightMatch` (wraps in `<mark class="gs-mark">`). Keyboard-navigatie: Ctrl/Cmd+K focust de zoekbalk vanaf elke plek, ArrowUp/ArrowDown lopen door resultaten, Enter opent het geselecteerde item, Escape sluit de dropdown. Een footer in de dropdown toont keyboard-hints en een `.gs-kbd-badge` in de input markeert Ctrl+K. Bijbehorende styling in de sectie SEARCH van `css/style.css` (`.gs-group-label`, `.gs-row`, `.gs-row.is-active`, `.gs-icon`, `.gs-text`, `.gs-label`, `.gs-sub`, `.gs-mark`, `.gs-empty`, `.gs-footer`, `.gs-kbd-badge`). Agenda-hits openen de agendapagina en vervolgens de afspraakmodal.

## Aanpassingen en updates

- Pas dit document aan bij iedere functionele of architecturale wijziging.
- Werk de secties "Structuur", "Belangrijkste bestanden", "Werking" en "Recente functionaliteit" bij als er iets verandert.
- Actualiseer de datum onder "Laatste update".

## Laatste update
- Datum: 2026-04-13
- Opmerking: Performance-optimalisatie van de e-mailmodule in `js/pages/email-page.js`. Stale-while-revalidate via `localStorage` (cache-sleutels `_crm_inbox_cache_v1` en `_crm_trash_cache_v1` met helpers `_loadMailCache`/`_saveMailCache`), nieuwe flags `_inboxFetchedOnce`/`_trashFetchedOnce` zodat auto-fetch slechts één keer per sessie draait, blocker loading-pagina verwijderd uit `renderEmailPage()` (shell rendert direct, spinner alleen in refresh-knop en in lege lijst), fetch-limit verlaagd van 30 naar 20 berichten per map, en error-state houdt gecachte berichten zichtbaar. Geen schema- of Edge Function-wijzigingen.
