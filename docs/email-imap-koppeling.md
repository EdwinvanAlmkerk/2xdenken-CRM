# E-mail IMAP-koppeling — Technisch Voorbereidingsdocument

## Doel

De CRM e-mailmodule koppelen aan een echte mailserver via IMAP (ontvangen) en SMTP (verzenden), zodat:
- Inbox-berichten zichtbaar zijn in het CRM
- E-mails direct vanuit het CRM verstuurd worden (zonder mailto)
- Verzonden/ontvangen berichten automatisch gekoppeld worden aan contacten en scholen

---

## Waarom geen directe IMAP vanuit de browser?

IMAP is een TCP-protocol. Browsers ondersteunen alleen HTTP/HTTPS. Je hebt dus een **tussenlaag** (proxy) nodig die:
1. Via IMAP verbindt met de mailserver
2. E-mails ophaalt en als JSON teruggeeft via een REST API
3. Via SMTP e-mails verstuurt

---

## Aanbevolen architectuur: Supabase Edge Functions

```
Browser (CRM)
    │
    ▼
Supabase Edge Function (Deno/TypeScript)
    │
    ├── IMAP → mailserver (inbox ophalen)
    ├── SMTP → mailserver (e-mail verzenden)
    └── Supabase DB → email_log opslaan/lezen
```

### Waarom Edge Functions?

- Al onderdeel van je Supabase-project (geen extra hosting)
- Secrets-beheer voor wachtwoorden (niet in code)
- Directe toegang tot je Supabase database
- Gratis tot 500.000 aanroepen/maand

---

## Stap-voor-stap implementatieplan

### Stap 1 — IMAP-credentials opslaan

In Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```
IMAP_HOST=imap.jouwprovider.nl
IMAP_PORT=993
IMAP_USER=jorieke@2xdenken.nl
IMAP_PASS=wachtwoord_of_app_password
SMTP_HOST=smtp.jouwprovider.nl
SMTP_PORT=587
SMTP_USER=jorieke@2xdenken.nl
SMTP_PASS=wachtwoord_of_app_password
```

> **Tip:** Gebruik een app-wachtwoord als je 2FA hebt (Gmail, Microsoft 365).

---

### Stap 2 — Edge Function: inbox ophalen

Bestandsnaam: `supabase/functions/fetch-emails/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ImapFlow } from "npm:imapflow@1.0.162";

serve(async (req) => {
  // Authenticatie checken (Supabase JWT)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const client = new ImapFlow({
    host: Deno.env.get("IMAP_HOST"),
    port: Number(Deno.env.get("IMAP_PORT")),
    secure: true,
    auth: {
      user: Deno.env.get("IMAP_USER"),
      pass: Deno.env.get("IMAP_PASS"),
    },
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const messages = [];
      // Haal laatste 50 berichten op
      for await (const message of client.fetch("1:50", {
        envelope: true,
        source: true,
      })) {
        messages.push({
          uid: message.uid,
          from: message.envelope.from,
          to: message.envelope.to,
          subject: message.envelope.subject,
          date: message.envelope.date,
          // Body parsing zou hier komen
        });
      }
      return new Response(JSON.stringify(messages), {
        headers: { "Content-Type": "application/json" },
      });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
});
```

### Stap 3 — Edge Function: e-mail verzenden via SMTP

Bestandsnaam: `supabase/functions/send-email/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "npm:emailjs@4.0.3";

serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const { to, subject, body, html } = await req.json();

  const client = new SMTPClient({
    user: Deno.env.get("SMTP_USER"),
    password: Deno.env.get("SMTP_PASS"),
    host: Deno.env.get("SMTP_HOST"),
    port: Number(Deno.env.get("SMTP_PORT")),
    tls: true,
  });

  try {
    await client.sendAsync({
      from: Deno.env.get("SMTP_USER"),
      to,
      subject,
      text: body,
      attachment: html ? [{ data: html, alternative: true }] : undefined,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

---

### Stap 4 — CRM frontend aanpassen

De bestaande e-mailmodule moet op drie plekken worden aangepast:

#### 4a. Inbox toevoegen aan mappenstructuur

In `js/pages/email-page.js`:
- Nieuwe map "Inbox" toevoegen met fetch naar Edge Function
- Berichten tonen in dezelfde lijst-layout
- Bij klikken op een bericht: detail tonen
- Auto-koppeling: als het afzender-emailadres overeenkomt met een contact, school-koppeling tonen

#### 4b. Verzenden via SMTP i.p.v. mailto

In `js/email.js`:
- `sendEmail()` aanpassen: in plaats van `mailto:` link, POST naar Edge Function
- Resultaat afwachten, dan pas loggen in email_log en dossier
- Foutafhandeling als SMTP faalt

#### 4c. Instellingen: IMAP/SMTP configuratie

In `js/pages/instellingen.js`:
- Nieuwe sectie "E-mail server" met velden voor host, port, user, password
- Opslaan naar Supabase Secrets via Edge Function
- Test-knop om verbinding te verifiëren

---

### Stap 5 — Periodiek synchroniseren

Opties:
1. **On-demand**: inbox ophalen bij openen van E-mail pagina (simpelst)
2. **Cron job**: Supabase pg_cron die elke 5 minuten de Edge Function aanroept en nieuwe berichten in email_log opslaat
3. **Webhook**: sommige mailproviders (Gmail, Microsoft 365) ondersteunen push-notificaties

Aanbeveling: start met on-demand, eventueel later cron toevoegen.

---

## Benodigde informatie van de mailprovider

Voordat je begint, heb je nodig:

| Gegeven | Voorbeeld | Waar te vinden |
|---------|-----------|----------------|
| IMAP server | `imap.gmail.com` | Mailprovider documentatie |
| IMAP poort | `993` | Meestal 993 (SSL) |
| SMTP server | `smtp.gmail.com` | Mailprovider documentatie |
| SMTP poort | `587` | Meestal 587 (TLS) of 465 (SSL) |
| E-mailadres | `jorieke@2xdenken.nl` | Je mailadres |
| Wachtwoord | App-wachtwoord | Mailprovider instellingen |

### Veelgebruikte providers

| Provider | IMAP server | SMTP server |
|----------|------------|-------------|
| Gmail | `imap.gmail.com:993` | `smtp.gmail.com:587` |
| Microsoft 365 / Outlook | `outlook.office365.com:993` | `smtp.office365.com:587` |
| TransIP | `imap.transip.email:993` | `smtp.transip.email:587` |
| Strato | `imap.strato.com:993` | `smtp.strato.com:587` |
| Eigen domein (cPanel) | Vaak `mail.jouwdomein.nl:993` | `mail.jouwdomein.nl:587` |

---

## Voorbereidingen in de huidige code

De huidige e-mailmodule is al voorbereid voor deze koppeling:

1. **`email_log` tabel** — slaat al verzonden berichten op met alle metadata
2. **Mappenstructuur** — "Inbox" map kan eenvoudig worden toegevoegd naast Verzonden/Concepten
3. **Berichtenlijst + detailweergave** — werkt al, hoeft alleen data uit Edge Function te krijgen
4. **Compose modal** — "Open in e-mailprogramma" knop kan worden aangevuld/vervangen met "Versturen" knop
5. **Auto-koppeling** — contacten hebben al e-mailadressen; matching is een simpele lookup

### Wat er concreet moet veranderen bij activering:

| Component | Nu | Na IMAP-koppeling |
|-----------|----|--------------------|
| Inbox | Niet beschikbaar | Ophalen via Edge Function |
| Verzenden | mailto: link | POST naar Edge Function |
| Mappenstructuur | Verzonden + Concepten | + Inbox (+ evt. Archief, Prullenbak) |
| Compose modal | "Open in e-mailprogramma" | "Versturen" (direct via SMTP) |
| Instellingen | Templates + types | + Serverinstellingen |

---

## Kosten-inschatting

| Component | Kosten |
|-----------|--------|
| Supabase Edge Functions | Gratis (tot 500K aanroepen/maand) |
| Supabase database | Al beschikbaar |
| Mailserver | Al beschikbaar (bestaande zakelijke e-mail) |
| **Totaal** | **€ 0 extra** |

---

## Risico's en aandachtspunten

1. **App-wachtwoord vereist** — Bij Gmail en Microsoft 365 met 2FA moet je een app-specifiek wachtwoord aanmaken. Een gewoon wachtwoord werkt niet.
2. **Rate limits** — Mailproviders beperken het aantal IMAP-verbindingen. Niet vaker dan elke 2-5 minuten synchroniseren.
3. **Edge Function timeout** — Supabase Edge Functions hebben een timeout van 60 seconden. Bij grote inboxen moet je pagineren.
4. **Privacy** — E-mails bevatten gevoelige informatie. Overweeg of je alle e-mails in de database wilt opslaan of alleen metadata.
5. **Bijlagen** — IMAP-bijlagen zijn base64-encoded en kunnen groot zijn. Overweeg of je bijlagen wilt cachen in Supabase Storage.

---

## Volgende stap

Als je klaar bent om de koppeling te activeren:
1. Geef me de mailprovider gegevens (IMAP/SMTP servers)
2. Ik maak de Edge Functions
3. Ik pas de frontend aan voor Inbox + direct verzenden
4. We testen met een test-e-mail
