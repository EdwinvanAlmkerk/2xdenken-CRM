import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Minimale IMAP client met Deno TCP/TLS
async function fetchEmails(
  host: string, port: number, user: string, pass: string,
  folder: string, limit: number
): Promise<{ messages: any[]; total: number }> {
  // Verbind via TLS (port 993)
  const conn = await Deno.connectTls({ hostname: host, port });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let buffer = "";

  async function readLine(): Promise<string> {
    while (!buffer.includes("\r\n")) {
      const buf = new Uint8Array(8192);
      const n = await conn.read(buf);
      if (!n) break;
      buffer += decoder.decode(buf.subarray(0, n));
    }
    const idx = buffer.indexOf("\r\n");
    if (idx === -1) { const line = buffer; buffer = ""; return line; }
    const line = buffer.substring(0, idx);
    buffer = buffer.substring(idx + 2);
    return line;
  }

  async function readUntilTag(tag: string): Promise<string[]> {
    const lines: string[] = [];
    while (true) {
      const line = await readLine();
      lines.push(line);
      if (line.startsWith(tag + " ")) break;
    }
    return lines;
  }

  async function command(tag: string, cmd: string): Promise<string[]> {
    await conn.write(encoder.encode(`${tag} ${cmd}\r\n`));
    return await readUntilTag(tag);
  }

  try {
    // Greeting
    await readLine();

    // Login
    const loginRes = await command("A1", `LOGIN "${user}" "${pass}"`);
    const loginOk = loginRes.find(l => l.startsWith("A1 "));
    if (!loginOk?.includes("OK")) throw new Error("IMAP login mislukt: " + (loginOk || "geen response"));

    // Select folder
    const selRes = await command("A2", `SELECT "${folder}"`);
    let totalMessages = 0;
    for (const line of selRes) {
      const m = line.match(/\*\s+(\d+)\s+EXISTS/);
      if (m) totalMessages = parseInt(m[1]);
    }

    const messages: any[] = [];

    if (totalMessages > 0) {
      const startSeq = Math.max(1, totalMessages - limit + 1);

      // Fetch envelope + body preview
      const fetchRes = await command("A3", `FETCH ${startSeq}:${totalMessages} (UID FLAGS ENVELOPE BODY.PEEK[TEXT]<0.500>)`);

      let currentMsg: any = null;

      for (const line of fetchRes) {
        // Start van een nieuw bericht
        const fetchMatch = line.match(/^\*\s+(\d+)\s+FETCH\s+\(/);
        if (fetchMatch) {
          if (currentMsg) messages.push(currentMsg);
          currentMsg = { seq: parseInt(fetchMatch[1]) };
        }

        if (!currentMsg) continue;

        // UID
        const uidMatch = line.match(/UID\s+(\d+)/);
        if (uidMatch) currentMsg.uid = parseInt(uidMatch[1]);

        // FLAGS
        const flagsMatch = line.match(/FLAGS\s+\(([^)]*)\)/);
        if (flagsMatch) currentMsg.flags = flagsMatch[1].split(/\s+/).filter(Boolean);

        // ENVELOPE parsing
        const envMatch = line.match(/ENVELOPE\s+\((.+)\)/);
        if (envMatch) {
          try {
            const env = envMatch[1];

            // Datum
            const dateMatch = env.match(/^"([^"]*)"/);
            if (dateMatch) currentMsg.date = dateMatch[1];

            // Onderwerp - kan quoted of literal zijn
            const subjMatch = env.match(/^"[^"]*"\s+"([^"]*)"/);
            if (subjMatch) {
              currentMsg.subject = decodeImapString(subjMatch[1]);
            } else {
              const subjMatch2 = env.match(/^"[^"]*"\s+NIL/);
              if (subjMatch2) currentMsg.subject = "(geen onderwerp)";
            }

            // From - zoek het patroon ((name NIL mailbox host))
            const fromMatch = env.match(/\(\("?([^"]*)"?\s+NIL\s+"([^"]*)"\s+"([^"]*)"\)\)/);
            if (fromMatch) {
              currentMsg.from = {
                name: decodeImapString(fromMatch[1] === "NIL" ? "" : fromMatch[1]),
                email: `${fromMatch[2]}@${fromMatch[3]}`
              };
            }
          } catch (_e) {
            // Envelope parsing is complex, skip bij fouten
          }
        }

        // Body text preview
        if (line.includes("BODY[TEXT]")) {
          const textMatch = line.match(/BODY\[TEXT\]<0>\s+\{(\d+)\}/);
          if (textMatch) {
            // Literal volgt op de volgende regel(s)
            // We hebben het al in de buffer via readUntilTag
          }
        }
      }

      if (currentMsg) messages.push(currentMsg);

      // Nieuwste eerst
      messages.reverse();
    }

    // Logout
    await command("A4", "LOGOUT");
    conn.close();

    // Cleanup: zorg dat elk bericht minimaal de basis velden heeft
    return {
      messages: messages.map(m => ({
        uid: m.uid || m.seq,
        seq: m.seq,
        flags: m.flags || [],
        from: m.from || { name: "", email: "" },
        subject: m.subject || "(geen onderwerp)",
        date: m.date || "",
        read: (m.flags || []).includes("\\Seen"),
      })),
      total: totalMessages,
    };
  } catch (e) {
    try { conn.close(); } catch (_) {}
    throw e;
  }
}

// Decode IMAP encoded strings (=?UTF-8?B?...?= en =?UTF-8?Q?...?=)
function decodeImapString(s: string): string {
  if (!s) return "";
  return s.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (_, charset, encoding, data) => {
    try {
      if (encoding.toUpperCase() === "B") {
        return new TextDecoder(charset).decode(Uint8Array.from(atob(data), c => c.charCodeAt(0)));
      }
      if (encoding.toUpperCase() === "Q") {
        const decoded = data.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
        return decoded;
      }
    } catch (_) {}
    return data;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settings } = await supabase
      .from("email_settings")
      .select("*")
      .eq("id", "main")
      .single();

    if (!settings?.imap_host) {
      return new Response(JSON.stringify({ error: "IMAP niet geconfigureerd" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const url = new URL(req.url);
    const folder = url.searchParams.get("folder") || "INBOX";
    const limit = parseInt(url.searchParams.get("limit") || "30");

    console.log(`Fetching ${limit} emails from ${folder} via ${settings.imap_host}:${settings.imap_port}`);

    const result = await fetchEmails(
      settings.imap_host,
      settings.imap_port || 993,
      settings.email_user,
      settings.email_pass,
      folder,
      limit
    );

    console.log(`Fetched ${result.messages.length} messages (${result.total} total)`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
