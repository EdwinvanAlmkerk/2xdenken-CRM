// ════════════════════════════════════════════════════════════════
// AGENDA-FEED — publieke text/calendar (ICS) feed voor iPhone/webcal
// ════════════════════════════════════════════════════════════════
// Publiceert agenda-afspraken + ingeplande taken (met plan_datum) als een
// geldige VCALENDAR. Beveiligd met een geheime token in de URL (?token=…).
// verify_jwt staat UIT zodat een agenda-app zonder auth de feed kan ophalen.
// Read-only: dit endpoint muteert niets.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// "09:00:00" of "09:00" → "0900"; leeg → ""
function hhmm(t: string | null): string {
  if (!t) return "";
  const m = String(t).match(/^(\d{2}):(\d{2})/);
  return m ? m[1] + m[2] : "";
}
// "2026-07-18" → "20260718"
function ymd(d: string): string { return String(d || "").replace(/-/g, ""); }
// datum + "0900" → "20260718T090000" (floating lokale tijd)
function icsLocal(datum: string, hm: string): string { return `${ymd(datum)}T${hm}00`; }
// Volgende dag (voor all-day DTEND, exclusief), "2026-07-18" → "20260719"
function nextDay(datum: string): string {
  const d = new Date(datum + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}
// Nu → UTC-stempel "20260711T122500Z"
function stampUTC(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}${String(d.getUTCSeconds()).padStart(2, "0")}Z`;
}
// "0900" + 60 min → "1000"
function addMinutes(hm: string, mins: number): string {
  if (!hm) return "";
  const h = parseInt(hm.slice(0, 2)), m = parseInt(hm.slice(2, 4));
  let total = h * 60 + m + mins;
  total = ((total % 1440) + 1440) % 1440;
  return String(Math.floor(total / 60)).padStart(2, "0") + String(total % 60).padStart(2, "0");
}
function escICS(s: string): string {
  return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Token valideren
    const { data: settings } = await supabase
      .from("feed_settings").select("token").eq("id", "main").single();
    if (!settings?.token || token !== settings.token) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Data ophalen (service role → RLS niet relevant)
    const [aRes, tRes, sRes, cRes] = await Promise.all([
      supabase.from("agenda").select("*"),
      supabase.from("taken").select("*").not("plan_datum", "is", null),
      supabase.from("scholen").select("id,naam"),
      supabase.from("contacten").select("id,naam"),
    ]);
    const agenda = aRes.data || [];
    const taken = tRes.data || [];
    const schoolNaam = new Map((sRes.data || []).map((s: any) => [s.id, s.naam]));
    const contactNaam = new Map((cRes.data || []).map((c: any) => [c.id, c.naam]));

    const dtstamp = stampUTC(new Date());
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//2xDenken CRM//Agenda//NL",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:2xDenken CRM",
      "X-WR-TIMEZONE:Europe/Amsterdam",
    ];

    const addEvent = (uid: string, datum: string, begin: string, eind: string, summary: string, description: string, location: string) => {
      if (!datum) return;
      lines.push("BEGIN:VEVENT");
      lines.push("UID:" + uid);
      lines.push("DTSTAMP:" + dtstamp);
      if (begin) {
        lines.push("DTSTART:" + icsLocal(datum, begin));
        lines.push("DTEND:" + icsLocal(datum, eind || addMinutes(begin, 60)));
      } else {
        lines.push("DTSTART;VALUE=DATE:" + ymd(datum));
        lines.push("DTEND;VALUE=DATE:" + nextDay(datum));
      }
      lines.push("SUMMARY:" + escICS(summary));
      const desc = (description || "").slice(0, 400);
      if (desc) lines.push("DESCRIPTION:" + escICS(desc));
      if (location) lines.push("LOCATION:" + escICS(location));
      lines.push("END:VEVENT");
    };

    for (const a of agenda) {
      const koppel = [schoolNaam.get(a.school_id), contactNaam.get(a.contact_id)].filter(Boolean).join(" · ");
      addEvent(
        "agenda-" + a.id + "@2xdenken",
        a.datum, hhmm(a.begin_tijd), hhmm(a.eind_tijd),
        a.titel || "Afspraak",
        [koppel, a.notitie].filter(Boolean).join("\n"),
        a.locatie || "",
      );
    }
    for (const t of taken) {
      const koppel = [schoolNaam.get(t.school_id), contactNaam.get(t.contact_id)].filter(Boolean).join(" · ");
      addEvent(
        "taak-" + t.id + "@2xdenken",
        t.plan_datum, hhmm(t.plan_begin_tijd), hhmm(t.plan_eind_tijd),
        "📋 " + (t.onderwerp || "Taak"),
        [koppel, t.tekst].filter(Boolean).join("\n"),
        "",
      );
    }

    lines.push("END:VCALENDAR");
    const body = lines.join("\r\n") + "\r\n";
    return new Response(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="2xdenken-crm.ics"',
        "Cache-Control": "no-cache, max-age=0",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response("Error: " + (e as Error).message, { status: 500 });
  }
});
