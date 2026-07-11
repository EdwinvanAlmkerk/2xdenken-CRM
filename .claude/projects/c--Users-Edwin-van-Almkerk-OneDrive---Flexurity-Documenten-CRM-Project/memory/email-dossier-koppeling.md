---
name: email-dossier-koppeling
description: Status e-mail↔contact-koppeling in CRM — welke delen live zijn en wat teruggedraaid is
metadata:
  type: project
---

Doel gebruiker: e-mails van/aan contactpersonen automatisch als dossieritem onder de persoon loggen (chronologische tijdlijn van notities + mail), doorrollend naar schoolniveau (bestuur = alleen notities).

**Live en werkend** (commits t/m d411af9):
- Ontvangen inbox-mail wordt automatisch onder het gematchte contact gelogd (match op e-mailADRES) — bestond al.
- Verzonden mail wordt betrouwbaar gelogd (fix: contact_id werd niet gepersisteerd). Type `email-verzonden`, icoon 📤.
- E-mails rollen mee naar het schooldossier (`dossiersBySchool` bevat inbox-mails); bestuursdossier filtert mails eruit via `isEmailDossier`.
- Iconen in `renderDossierItem`: 📝 notitie · 📧 ontvangen · 📤 verzonden · 📎 bestand.

**Teruggedraaid** (commit 98932e3 → revert d00b61a) wegens login-bevriezing door de auto-startup-sync. **NIET opnieuw als auto-startup toevoegen.** Niet teruggekeerd: naam-matching in de reguliere inbox-auto-log (`getContactByName`/`contactByName`-index) en de "Koppel aan contact"-knop per bericht.

**Opnieuw opgebouwd** (commit 918f87d, "Historie koppelen", edge function v12) — handmatig en veilig:
- Knop "Historie koppelen" op de E-mailpagina → `openBackfillModal`/`runBackfillAllFolders`/`_bulkCoupleMails` in email-page.js.
- Doorloopt **alle** mailmappen sinds een datum (edge `action=backfill&since=`), koppelt ontvangen mail op afzender en verzonden mail op ontvanger (adres óf naam, lokale naam-index — géén globale index).
- Edge function heeft echte `parseEnvelope` (afzender + ontvangers, lokaal getest 4/4) + `searchSince`/`fetchEnvelopesByUids`/`toImapDate`.
- Async met awaits, self-contained → kan de hoofd-thread niet bevriezen. Géén startup-sync.

Reguliere inbox-sync (E-mailpagina openen / vernieuw-knop) matcht nog steeds alleen op exact e-mailADRES en alleen INBOX. Zie [[deploy-caution-crm]].

STATUS: "Historie koppelen" werkt live (bevestigd door gebruiker, versie email-page.js ?v=20260711-historie5). Idempotent: dossier-id's zijn map+uid-gebaseerd, dedup via Set + PK, dus opnieuw draaien geeft geen dubbelingen — het vult alleen nieuw-matchbare berichten aan.

BUG-LES (kostte veel tijd): geef NOOIT een custom `headers`-object mee aan `supa()` in db.js. Door `{ headers: {...defaults}, ...options }` overschrijft `options.headers` de samengevoegde headers volledig → apikey/Authorization verdwijnen → 401 "No API key found in request" (werd misleidend als "sessie verlopen" getoond). Wil je een header als Prefer meegeven, dan moet supa() eerst gefixt worden (headers los mergen). Zie [[deploy-caution-crm]].

Losstaand nog gewenst: takenmodule die taken onder contactpersonen logt (zelfde dossier-tijdlijn).
