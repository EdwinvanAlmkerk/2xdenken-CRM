# E-mailmodule — Voorstel voor 2xDenken CRM

## Samenvatting

Een e-mailmodule die drie lagen combineert: (1) snel e-mails starten vanuit het CRM met vooringevulde templates, (2) automatisch loggen van verzonden e-mails in het dossier, en (3) optioneel daadwerkelijk verzenden vanuit het CRM via een e-mailservice.

---

## Fase 1 — Templates + mailto (geen extra infra nodig)

### Wat het doet
- **E-mailtemplates** beheren via Instellingen (bijv. "Factuurherinnering", "Intake-uitnodiging", "Opvolging na training")
- **Variabelen** in templates die automatisch worden ingevuld: `{{contactnaam}}`, `{{schoolnaam}}`, `{{bestuursnaam}}`, `{{factuurnummer}}`, `{{factuurbedrag}}`, `{{vervaldatum}}`, etc.
- **"Stuur e-mail" knop** op contactdetail, schooldetail en factuurpagina
- Opent een `mailto:`-link met vooringevuld onderwerp en body → opent in Outlook/Gmail van de gebruiker
- Na het openen wordt automatisch een dossiernotitie aangemaakt: "E-mail verstuurd: [onderwerp]" met de volledige tekst

### Supabase-tabel: `email_templates`

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| `id` | TEXT PK | Unieke ID |
| `naam` | TEXT | Templatenaam (bijv. "Factuurherinnering") |
| `onderwerp` | TEXT | E-mail onderwerpregel met variabelen |
| `body` | TEXT | E-mailtekst met variabelen |
| `categorie` | TEXT | factuur / intake / opvolging / overig |
| `created_at` | TIMESTAMPTZ | Aanmaakdatum |

### Waar de knoppen komen
- **Contactdetailpagina** → "E-mail sturen" knop → kiest template, vult contactgegevens in
- **Factuuroverzicht** → bij elke factuur een e-mail-icoontje → opent template "Factuurherinnering" met factuurnummer, bedrag, vervaldatum ingevuld
- **Schooldetailpagina** → "E-mail sturen" knop → kiest template + contactpersoon van die school

### Voordelen
- Geen extra infrastructuur nodig
- Werkt met elk e-mailprogramma (Outlook, Gmail, Apple Mail)
- Templates zijn herbruikbaar en bewerkbaar
- Elke e-mail wordt automatisch gelogd in het dossier

### Beperkingen
- Je moet de e-mail nog handmatig verzenden vanuit je e-mailprogramma
- Geen tracking of de e-mail daadwerkelijk is verstuurd/gelezen
- Opmaak is beperkt tot platte tekst (mailto ondersteunt geen HTML)

---

## Fase 2 — E-maillog en overzicht

### Wat het doet
- Aparte **"E-mails" tab** op school- en contactdetailpagina's (naast Dossier, Agenda)
- Overzicht van alle e-mails die vanuit het CRM zijn gestart, met datum, onderwerp, ontvanger en template
- **E-mail sidebar-item** onder "Overzicht" → chronologisch overzicht van alle e-mails
- Filteren op school, contact, template, periode

### Supabase-tabel: `email_log`

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| `id` | TEXT PK | Unieke ID |
| `template_id` | TEXT | FK naar email_templates (nullable) |
| `school_id` | TEXT | FK naar scholen (nullable) |
| `contact_id` | TEXT | FK naar contacten (nullable) |
| `factuur_id` | TEXT | FK naar facturen (nullable) |
| `aan_email` | TEXT | Ontvanger e-mailadres |
| `onderwerp` | TEXT | Ingevuld onderwerp |
| `body` | TEXT | Ingevulde tekst |
| `status` | TEXT | 'geopend' / 'verzonden' / 'mislukt' |
| `datum` | TIMESTAMPTZ | Tijdstip |

### Voordelen
- Compleet overzicht van alle communicatie
- Doorzoekbaar en filterbaar
- Koppeling met school/contact/factuur

---

## Fase 3 — Daadwerkelijk verzenden vanuit het CRM (optioneel)

### Wat het doet
- E-mails worden **direct vanuit het CRM verzonden** zonder dat Outlook/Gmail opent
- Ondersteunt HTML-opmaak (professionelere e-mails)
- Factuur als PDF-bijlage meesturen
- Status-tracking: verzonden / mislukt
- Optioneel: BCC naar eigen e-mailadres voor archivering

### Technische vereisten

**Optie A — Supabase Edge Function + Resend**
- [Resend](https://resend.com) als e-mailservice (gratis tot 3.000 e-mails/maand)
- Supabase Edge Function die de Resend API aanroept
- Eigen domein nodig voor afzender-verificatie (bijv. `facturen@2xdenken.nl`)
- Kosten: gratis voor normaal CRM-gebruik

**Optie B — Supabase Edge Function + SMTP (bijv. bestaande zakelijke e-mail)**
- Gebruik je bestaande zakelijke e-mailaccount als afzender
- SMTP-credentials opslaan in Supabase Secrets
- Geen extra kosten, maar SMTP kan rate-limits hebben

### Supabase Edge Function (voorbeeld)

```
POST /functions/v1/send-email
Body: {
  to: "jan@school.nl",
  subject: "Factuur 202501 — 2xDenken",
  html: "<p>Beste Jan, ...</p>",
  attachments: [{ filename: "factuur-202501.pdf", content: "base64..." }]
}
```

### Voordelen
- Professionele HTML e-mails
- Factuur als bijlage
- Geen handmatige actie na klikken
- Status-tracking

### Nadelen
- Vereist Resend-account of SMTP-configuratie
- Domeinverificatie nodig
- Iets complexere setup

---

## Aanbevolen aanpak

| Stap | Wat | Complexiteit | Waarde |
|------|-----|-------------|--------|
| **1** | Templates + mailto + auto-log in dossier | Laag | Hoog |
| **2** | E-maillog tabel + overzichtspagina | Laag | Gemiddeld |
| **3** | Direct verzenden via Resend/SMTP | Gemiddeld | Hoog |

**Advies:** Start met fase 1. Dit levert direct waarde op zonder extra infrastructuur. Templates + mailto + dossierlog dekt 80% van de behoefte. Fase 3 kan later worden toegevoegd wanneer het volume toeneemt of je professionelere e-mails wilt sturen.

---

## Voorbeeld: workflow factuurherinnering

### Fase 1 (mailto)
1. Gebruiker opent facturenoverzicht → ziet factuur met status "verzonden" en vervaldatum verstreken
2. Klikt op e-mail-icoontje bij die factuur
3. Modal toont template "Factuurherinnering" met ingevulde variabelen:
   - Aan: jan@school.nl
   - Onderwerp: "Herinnering factuur 202501 — 2xDenken"
   - Body: "Beste Jan, Hierbij herinner ik u aan factuur 202501 van €1.250,00 met vervaldatum 15-03-2026..."
4. Gebruiker kan tekst aanpassen → klikt "Open in e-mail"
5. Outlook opent met alles ingevuld → gebruiker drukt op Verzenden
6. In het CRM wordt automatisch een dossiernotitie aangemaakt bij de school

### Fase 3 (direct verzenden)
- Zelfde flow, maar in stap 4 klikt de gebruiker op "Versturen" in het CRM zelf
- E-mail gaat direct uit, met factuur-PDF als bijlage
- Status wordt bijgewerkt naar "verzonden"

---

## Template-variabelen referentie

| Variabele | Bron | Voorbeeld |
|-----------|------|-----------|
| `{{contactnaam}}` | Contact | Jan de Vries |
| `{{contactfunctie}}` | Contact | Directeur |
| `{{contactemail}}` | Contact | jan@school.nl |
| `{{schoolnaam}}` | School | Basisschool Het Startblok |
| `{{schooladres}}` | School | Jan van Arkelweg 12 |
| `{{schoolplaats}}` | School | Achterveld |
| `{{bestuursnaam}}` | Bestuur | Stichting Voila |
| `{{debiteurnummer}}` | School | DB15 |
| `{{factuurnummer}}` | Factuur | 202501 |
| `{{factuurbedrag}}` | Factuur | € 1.250,00 |
| `{{factuurdatum}}` | Factuur | 01-02-2026 |
| `{{vervaldatum}}` | Factuur | 15-03-2026 |
| `{{factuurbetreft}}` | Factuur | Coachtraject groep 7 |
| `{{vandaag}}` | Systeem | 12 april 2026 |
| `{{gebruikersnaam}}` | Sessie | Edwin |
