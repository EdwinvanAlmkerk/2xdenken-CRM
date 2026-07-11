---
name: deploy-caution-crm
description: Werkafspraken voor veilig deployen naar het 2xDenken CRM (GitHub Pages, live)
metadata:
  type: feedback
---

Bij het 2xDenken CRM (statische app, live op GitHub Pages, geen staging) gelden deze afspraken na een incident waarbij een gebundelde batch de app na login liet bevriezen (oneindige lus op de hoofd-thread → eeuwige spinner, geen console-fout).

**Waarom:** een wijziging die automatisch bij elke login draaide (achtergrond-inbox-sync) blokkeerde de hoofd-thread vóór het dashboard rendde. Werd niet vooraf end-to-end getest omdat ik geen login-toegang heb.

**How to apply:**
- Deploy klein en apart; bundel risicovolle wijzigingen niet met andere. Zo is bij een probleem meteen duidelijk wélke commit het was en is terugdraaien makkelijk (`git revert <sha>` + push werkte binnen minuten).
- Zet geen code neer die je niet end-to-end hebt gedraaid. Vraag de gebruiker na élke deploy of inloggen nog werkt vóór je verder bouwt.
- Vermijd automatisch draaiende achtergrondtaken bij het opstarten/login zonder aan/uit-knop. Geef de voorkeur aan handmatige knoppen boven "doet-alles-vanzelf"-code.
- Een vastloper (infinite loop) geeft géén console-fout; bij "pagina reageert niet" is het een synchrone lus. Diagnose: F12 → Sources → pauze ⏸ toont de vastlopende regel.

Zie ook [[email-dossier-koppeling]] (de teruggedraaide feature die opnieuw opgebouwd moet worden, zonder startup-sync).
