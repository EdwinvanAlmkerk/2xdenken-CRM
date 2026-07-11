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

**Teruggedraaid** (commit 98932e3 → revert d00b61a) wegens login-bevriezing, moet opnieuw en veilig opgebouwd worden:
- Naam-matching in `logInboxToDossier` (`getContactByName` + `contactByName`-index in db.js) + adres "leren" (`_maybeLearnContactEmail`).
- Achtergrond-inbox-sync bij login in `loadAllData` — **dit was de vermoedelijke boosdoener; NIET terugzetten als auto-startup**.
- Handmatige knoppen in email-page.js: "Koppel aan contact" (`openKoppelMailModal`/`saveKoppelMail`) en "Historie koppelen" backfill (`openBackfillModal`/`runBackfillInbox`/`_bulkLogInbox`).
- Edge function `fetch-emails` v11 (IMAP SEARCH SINCE via `searchSince`/`fetchByUids`/`toImapDate` + `since`-tak) — dit is additief en bleef gedeployed; alleen de frontend die het aanroept is teruggedraaid.

Herbouw-aanpak: alleen handmatige knoppen, géén startup-sync, en per stap end-to-end testen. Zie [[deploy-caution-crm]].

Losstaand nog gewenst: takenmodule die taken onder contactpersonen logt (zelfde dossier-tijdlijn).
