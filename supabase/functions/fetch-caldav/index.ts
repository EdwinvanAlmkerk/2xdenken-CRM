// ════════════════════════════════════════════════════════════════
// fetch-caldav — haalt events op uit iCloud/CalDAV
// Gebruikt PROPFIND discovery + REPORT calendar-query
// ════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════
// CalDAV client
// ═══════════════════════════════════════════════════════════════
class CalDavClient {
  serverUrl: string;
  authHeader: string;

  constructor(appleId: string, appPassword: string, serverUrl = "https://caldav.icloud.com") {
    this.serverUrl = serverUrl.replace(/\/$/, "");
    const creds = btoa(`${appleId}:${appPassword}`);
    this.authHeader = `Basic ${creds}`;
  }

  async request(method: string, path: string, body: string | null, depth = "0"): Promise<string> {
    const url = path.startsWith("http") ? path : this.serverUrl + path;
    const headers: Record<string, string> = {
      "Authorization": this.authHeader,
      "Content-Type": "application/xml; charset=utf-8",
      "Depth": depth,
      "User-Agent": "2xDenken-CRM/1.0",
    };
    const res = await fetch(url, {
      method,
      headers,
      body: body || undefined,
    });
    const text = await res.text();
    if (res.status >= 400) {
      throw new Error(`CalDAV ${method} ${url}: HTTP ${res.status} — ${text.slice(0, 300)}`);
    }
    return text;
  }

  // Stap 1: vind current-user-principal
  async getCurrentUserPrincipal(): Promise<string> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal/></d:prop>
</d:propfind>`;
    const res = await this.request("PROPFIND", "/", body, "0");
    const m = res.match(/<[a-z0-9]*:?current-user-principal[^>]*>\s*<[a-z0-9]*:?href[^>]*>([^<]+)<\/[a-z0-9]*:?href>/i);
    if (!m) throw new Error("current-user-principal niet gevonden — check login");
    return this.absolutize(m[1].trim());
  }

  // Stap 2: vind calendar-home-set
  async getCalendarHomeSet(principalUrl: string): Promise<string> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set/></d:prop>
</d:propfind>`;
    const res = await this.request("PROPFIND", principalUrl, body, "0");
    const m = res.match(/<[a-z0-9]*:?calendar-home-set[^>]*>\s*<[a-z0-9]*:?href[^>]*>([^<]+)<\/[a-z0-9]*:?href>/i);
    if (!m) throw new Error("calendar-home-set niet gevonden");
    return this.absolutize(m[1].trim());
  }

  // Stap 3: lijst alle kalenders in home set
  async listCalendars(homeSetUrl: string): Promise<Array<{ url: string; name: string }>> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:resourcetype/>
    <d:displayname/>
    <c:supported-calendar-component-set/>
  </d:prop>
</d:propfind>`;
    const res = await this.request("PROPFIND", homeSetUrl, body, "1");
    const calendars: Array<{ url: string; name: string }> = [];
    const responseRegex = /<[a-z0-9]*:?response[^>]*>([\s\S]*?)<\/[a-z0-9]*:?response>/gi;
    let match;
    while ((match = responseRegex.exec(res)) !== null) {
      const chunk = match[1];
      // Moet een calendar zijn (niet de home set zelf of andere resource types)
      const isCalendar = /<[a-z0-9]*:?resourcetype[^>]*>[\s\S]*?<[a-z0-9]*:?calendar[\s/>]/i.test(chunk);
      if (!isCalendar) continue;
      // Moet VEVENT ondersteunen (filter out VTODO-only calendars)
      const supportsEvent = /<[a-z0-9]*:?comp[^>]*name="VEVENT"/i.test(chunk)
        || !/<[a-z0-9]*:?supported-calendar-component-set/i.test(chunk);
      if (!supportsEvent) continue;
      const hrefMatch = chunk.match(/<[a-z0-9]*:?href[^>]*>([^<]+)<\/[a-z0-9]*:?href>/i);
      const nameMatch = chunk.match(/<[a-z0-9]*:?displayname[^>]*>([^<]*)<\/[a-z0-9]*:?displayname>/i);
      if (hrefMatch) {
        calendars.push({
          url: this.absolutize(hrefMatch[1].trim()),
          name: nameMatch ? nameMatch[1].trim() : "Kalender",
        });
      }
    }
    return calendars;
  }

  // Stap 4: haal events op voor een kalender in een tijdsbereik
  async fetchEvents(calendarUrl: string, startIcs: string, endIcs: string): Promise<string[]> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${startIcs}" end="${endIcs}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;
    const res = await this.request("REPORT", calendarUrl, body, "1");
    const blocks: string[] = [];
    const dataRegex = /<[a-z0-9]*:?calendar-data[^>]*>([\s\S]*?)<\/[a-z0-9]*:?calendar-data>/gi;
    let match;
    while ((match = dataRegex.exec(res)) !== null) {
      const decoded = match[1]
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&");
      blocks.push(decoded);
    }
    return blocks;
  }

  // Helper: maak een relatieve href absoluut (voor Apple's cross-host redirects)
  private absolutize(href: string): string {
    if (href.startsWith("http")) return href;
    // Pad moet beginnen met /
    return href.startsWith("/") ? href : "/" + href;
  }
}

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
  // UTC (eindigt op Z)
  let m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (m) return { iso: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`, allDay: false };
  // Floating of TZID — voor MVP behandeld als lokale tijd (geen Z)
  m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (m) return { iso: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`, allDay: false };
  return null;
}

function parseIcalendar(icalText: string): ParsedEvent[] {
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
  return events;
}

// ═══════════════════════════════════════════════════════════════
// Helper: format ISO datum als iCalendar UTC timestamp
// ═══════════════════════════════════════════════════════════════
function icalFormat(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
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
      .from("caldav_settings")
      .select("*")
      .eq("id", "main")
      .single();

    if (!settings?.apple_id || !settings?.app_password) {
      return new Response(JSON.stringify({ error: "iCloud CalDAV niet geconfigureerd" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const startParam = url.searchParams.get("start");
    const endParam = url.searchParams.get("end");
    const doTest = url.searchParams.get("test") === "true";

    const client = new CalDavClient(settings.apple_id, settings.app_password, settings.server_url);

    let calendarUrl = settings.calendar_url;
    let calendarName = settings.calendar_name;

    // Discovery: doe de PROPFIND keten als we nog geen calendar_url gecached hebben, of bij expliciete test
    if (!calendarUrl || doTest) {
      console.log("Running CalDAV discovery...");
      const principal = await client.getCurrentUserPrincipal();
      const homeSet = await client.getCalendarHomeSet(principal);
      const calendars = await client.listCalendars(homeSet);

      if (calendars.length === 0) {
        return new Response(JSON.stringify({ error: "Geen kalenders gevonden voor dit account" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      calendarUrl = calendars[0].url;
      calendarName = calendars[0].name;

      await supabase.from("caldav_settings").update({
        principal_url: principal,
        calendar_url: calendarUrl,
        calendar_name: calendarName,
      }).eq("id", "main");

      if (doTest) {
        return new Response(JSON.stringify({
          ok: true,
          calendars: calendars.length,
          firstCalendar: calendarName,
          allCalendars: calendars.map(c => c.name),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Default range: 30 dagen terug tot 90 dagen vooruit
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 86400000);
    const defaultEnd = new Date(now.getTime() + 90 * 86400000);
    const startIcs = startParam || icalFormat(defaultStart);
    const endIcs = endParam || icalFormat(defaultEnd);

    console.log(`Fetching CalDAV events from ${calendarName}`);
    const blocks = await client.fetchEvents(calendarUrl, startIcs, endIcs);

    const allEvents: ParsedEvent[] = [];
    for (const block of blocks) {
      allEvents.push(...parseIcalendar(block));
    }

    // Dedupe op UID
    const unique = new Map<string, ParsedEvent>();
    for (const e of allEvents) {
      if (!unique.has(e.uid)) unique.set(e.uid, e);
    }

    return new Response(JSON.stringify({
      events: Array.from(unique.values()),
      calendar: calendarName,
      range: { start: startIcs, end: endIcs },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("CalDAV error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
