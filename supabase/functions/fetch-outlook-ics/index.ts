// ════════════════════════════════════════════════════════════════
// fetch-outlook-ics — haalt events uit een Outlook gepubliceerde .ics feed
// Eén HTTP call, geen auth, iCalendar parsing, datumfilter
// ════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════
// iCalendar parsing
// ═══════════════════════════════════════════════════════════════
interface ParsedEvent {
  uid: string;
  summary: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  location: string;
  description: string;
}

function unescapeIcal(s: string): string {
  return s
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcalDate(value: string, params: Record<string, string>): { iso: string; allDay: boolean } | null {
  if (params.VALUE === "DATE" || /^\d{8}$/.test(value)) {
    const m = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) return null;
    return { iso: `${m[1]}-${m[2]}-${m[3]}`, allDay: true };
  }
  // UTC: 20260413T100000Z
  let m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (m) return { iso: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`, allDay: false };
  // Floating of TZID → behandel als lokaal
  m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (m) return { iso: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`, allDay: false };
  return null;
}

function parseIcalendar(icalText: string): { events: ParsedEvent[]; calendarName: string } {
  // Unfold lines: regels beginnend met spatie/tab zijn voortzetting van vorige regel
  const unfolded: string[] = [];
  const rawLines = icalText.split(/\r?\n/);
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  const events: ParsedEvent[] = [];
  let calendarName = "";
  let current: Partial<ParsedEvent> | null = null;
  let inVEvent = false;

  for (const line of unfolded) {
    if (line === "BEGIN:VEVENT") {
      current = { summary: "", location: "", description: "", uid: "", start: null, end: null, allDay: false };
      inVEvent = true;
      continue;
    }
    if (line === "END:VEVENT") {
      if (current && current.uid && current.start) {
        events.push(current as ParsedEvent);
      }
      current = null;
      inVEvent = false;
      continue;
    }
    // X-WR-CALNAME buiten VEVENT = kalender naam
    if (!inVEvent && line.startsWith("X-WR-CALNAME:")) {
      calendarName = line.slice("X-WR-CALNAME:".length).trim();
      continue;
    }
    if (!inVEvent || !current) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const keyPart = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const [rawKey, ...paramParts] = keyPart.split(";");
    const key = rawKey.toUpperCase();
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const [pk, pv] = p.split("=");
      if (pk && pv) params[pk.toUpperCase()] = pv;
    }

    switch (key) {
      case "UID":
        current.uid = value;
        break;
      case "SUMMARY":
        current.summary = unescapeIcal(value);
        break;
      case "LOCATION":
        current.location = unescapeIcal(value);
        break;
      case "DESCRIPTION":
        current.description = unescapeIcal(value);
        break;
      case "DTSTART": {
        const parsed = parseIcalDate(value, params);
        if (parsed) {
          current.start = parsed.iso;
          current.allDay = parsed.allDay;
        }
        break;
      }
      case "DTEND": {
        const parsed = parseIcalDate(value, params);
        if (parsed) current.end = parsed.iso;
        break;
      }
    }
  }
  return { events, calendarName };
}

// ═══════════════════════════════════════════════════════════════
// SERVE
// ═══════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settings } = await supabase
      .from("outlook_settings")
      .select("*")
      .eq("id", "main")
      .single();

    if (!settings?.ics_url) {
      return new Response(JSON.stringify({ error: "Outlook ICS URL niet geconfigureerd" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const doTest = url.searchParams.get("test") === "true";

    // Normaliseer webcal:// naar https://
    let icsUrl = settings.ics_url.trim();
    if (icsUrl.startsWith("webcal://")) icsUrl = "https://" + icsUrl.slice(9);

    console.log(`Fetching Outlook ICS from ${icsUrl}`);
    const res = await fetch(icsUrl, {
      headers: {
        "User-Agent": "2xDenken-CRM/1.0",
        "Accept": "text/calendar, text/plain, */*",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} bij ophalen ICS feed`);
    }

    const icsText = await res.text();
    if (!icsText.includes("BEGIN:VCALENDAR")) {
      throw new Error("Response bevat geen geldige iCalendar data");
    }

    const { events: allEvents, calendarName } = parseIcalendar(icsText);

    // Update kalender-naam in DB als die anders is
    if (calendarName && calendarName !== settings.calendar_name) {
      await supabase.from("outlook_settings").update({ calendar_name: calendarName }).eq("id", "main");
    }

    if (doTest) {
      return new Response(JSON.stringify({
        ok: true,
        totalEvents: allEvents.length,
        calendarName: calendarName || "(naam onbekend)",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Filter op datumbereik uit settings
    const daysPast = settings.days_past ?? 30;
    const daysFuture = settings.days_future ?? 180;
    const now = new Date();
    const minDate = new Date(now.getTime() - daysPast * 86400000);
    const maxDate = new Date(now.getTime() + daysFuture * 86400000);
    const minIso = minDate.toISOString().slice(0, 10);
    const maxIso = maxDate.toISOString().slice(0, 10);

    const filtered = allEvents.filter(e => {
      if (!e.start) return false;
      const eventDate = e.start.slice(0, 10);
      return eventDate >= minIso && eventDate <= maxIso;
    });

    // Dedupe op UID
    const unique = new Map<string, ParsedEvent>();
    for (const e of filtered) {
      if (!unique.has(e.uid)) unique.set(e.uid, e);
    }

    return new Response(JSON.stringify({
      events: Array.from(unique.values()),
      calendar: calendarName,
      range: { daysPast, daysFuture, from: minIso, to: maxIso },
      totalInFeed: allEvents.length,
      shownEvents: unique.size,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Outlook ICS error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
