import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════
// MIME PARSER
// ═══════════════════════════════════════════════════════════════

function parseMimeMessage(raw: string): { headers: Map<string, string>; body: string } {
  // Vind de scheiding tussen headers en body
  let sepIdx = raw.indexOf("\r\n\r\n");
  let sepLen = 4;
  if (sepIdx === -1) {
    sepIdx = raw.indexOf("\n\n");
    sepLen = 2;
  }
  if (sepIdx === -1) return { headers: new Map(), body: raw };

  // Unfold headers (continuation lines starten met whitespace)
  const headerBlock = raw.substring(0, sepIdx).replace(/\r?\n([ \t])/g, " ");
  const body = raw.substring(sepIdx + sepLen);

  const headers = new Map<string, string>();
  const lineBreak = headerBlock.includes("\r\n") ? "\r\n" : "\n";
  for (const line of headerBlock.split(lineBreak)) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).toLowerCase().trim();
      const val = line.substring(colonIdx + 1).trim();
      headers.set(key, val);
    }
  }
  return { headers, body };
}

function splitMimeParts(body: string, boundary: string): string[] {
  const delim = "--" + boundary;
  const parts: string[] = [];
  const segments = body.split(delim);

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.startsWith("--")) break; // eind-boundary
    // Verwijder leading linebreak
    const cleaned = seg.replace(/^\r?\n/, "");
    if (cleaned.trim()) parts.push(cleaned);
  }
  return parts;
}

function decodeContent(content: string, encoding: string): string {
  const enc = (encoding || "7bit").toLowerCase().trim();

  if (enc === "base64") {
    try {
      const cleaned = content.replace(/[\r\n\s]/g, "");
      const bytes = Uint8Array.from(atob(cleaned), c => c.charCodeAt(0));
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    } catch {
      return content;
    }
  }

  if (enc === "quoted-printable") {
    return content
      .replace(/=\r?\n/g, "")  // soft line breaks
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
  }

  return content; // 7bit, 8bit, binary
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTextFromMime(raw: string): string {
  const { headers, body } = parseMimeMessage(raw);
  const contentType = headers.get("content-type") || "text/plain";
  const encoding = headers.get("content-transfer-encoding") || "7bit";
  const ctLower = contentType.toLowerCase();

  // Niet-multipart: direct decoderen
  if (!ctLower.includes("multipart")) {
    const decoded = decodeContent(body, encoding);

    if (ctLower.includes("text/plain")) {
      return decoded.trim();
    }
    if (ctLower.includes("text/html")) {
      return stripHtml(decoded);
    }
    // Ander type (image, application, etc.) — overslaan
    if (ctLower.includes("text/")) return decoded.trim();
    return "";
  }

  // Multipart: boundary zoeken en recursief parsen
  const boundaryMatch = contentType.match(/boundary="?([^";\r\n]+)"?/i);
  if (!boundaryMatch) return body.substring(0, 500); // fallback
  const boundary = boundaryMatch[1].trim();
  const parts = splitMimeParts(body, boundary);

  if (ctLower.includes("multipart/alternative")) {
    // Voorkeur: text/plain > text/html
    let plainText = "";
    let htmlText = "";
    for (const part of parts) {
      const partParsed = parseMimeMessage(part);
      const partCt = (partParsed.headers.get("content-type") || "").toLowerCase();
      if (partCt.includes("text/plain") && !plainText) {
        plainText = extractTextFromMime(part);
      } else if (partCt.includes("text/html") && !htmlText) {
        htmlText = extractTextFromMime(part);
      } else if (partCt.includes("multipart")) {
        const nested = extractTextFromMime(part);
        if (nested && !plainText) plainText = nested;
      }
    }
    return plainText || htmlText || "";
  }

  // multipart/mixed, multipart/related, etc.: eerste text-part pakken
  for (const part of parts) {
    const result = extractTextFromMime(part);
    if (result.trim()) return result;
  }
  return "";
}

// Decode IMAP encoded strings (=?UTF-8?B?...?= en =?UTF-8?Q?...?=)
function decodeImapString(s: string): string {
  if (!s) return "";
  return s.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (_, charset, enc, data) => {
    try {
      if (enc.toUpperCase() === "B") {
        return new TextDecoder(charset, { fatal: false }).decode(
          Uint8Array.from(atob(data), c => c.charCodeAt(0))
        );
      }
      if (enc.toUpperCase() === "Q") {
        return data
          .replace(/_/g, " ")
          .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) =>
            String.fromCharCode(parseInt(hex, 16))
          );
      }
    } catch { /* ignore */ }
    return data;
  });
}

// ═══════════════════════════════════════════════════════════════
// IMAP CLIENT
// ═══════════════════════════════════════════════════════════════

class ImapClient {
  private conn!: Deno.TlsConn;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  private buffer = "";
  private tagCounter = 0;

  async connect(host: string, port: number): Promise<void> {
    this.conn = await Deno.connectTls({ hostname: host, port });
    await this.readLine(); // greeting
  }

  private nextTag(): string {
    return `A${++this.tagCounter}`;
  }

  private async readLine(): Promise<string> {
    while (!this.buffer.includes("\r\n")) {
      const buf = new Uint8Array(16384);
      const n = await this.conn.read(buf);
      if (!n) break;
      this.buffer += this.decoder.decode(buf.subarray(0, n));
    }
    const idx = this.buffer.indexOf("\r\n");
    if (idx === -1) {
      const line = this.buffer;
      this.buffer = "";
      return line;
    }
    const line = this.buffer.substring(0, idx);
    this.buffer = this.buffer.substring(idx + 2);
    return line;
  }

  private async readBytes(n: number): Promise<string> {
    // Lees eerst uit buffer
    let result = "";
    if (this.buffer.length > 0) {
      if (this.buffer.length >= n) {
        result = this.buffer.substring(0, n);
        this.buffer = this.buffer.substring(n);
        return result;
      }
      result = this.buffer;
      this.buffer = "";
    }
    // Lees rest van de connectie
    while (result.length < n) {
      const buf = new Uint8Array(Math.min(32768, n - result.length + 4096));
      const bytesRead = await this.conn.read(buf);
      if (!bytesRead) break;
      result += this.decoder.decode(buf.subarray(0, bytesRead));
    }
    // Te veel gelezen? Terug in buffer
    if (result.length > n) {
      this.buffer = result.substring(n);
      result = result.substring(0, n);
    }
    return result;
  }

  async command(cmd: string): Promise<string[]> {
    const tag = this.nextTag();
    await this.conn.write(this.encoder.encode(`${tag} ${cmd}\r\n`));
    const lines: string[] = [];
    while (true) {
      const line = await this.readLine();
      lines.push(line);
      if (line.startsWith(`${tag} `)) break;
    }
    return lines;
  }

  async commandWithLiteral(cmd: string): Promise<{ lines: string[]; literal: string }> {
    const tag = this.nextTag();
    await this.conn.write(this.encoder.encode(`${tag} ${cmd}\r\n`));
    let literal = "";
    const lines: string[] = [];

    while (true) {
      const line = await this.readLine();

      // Check voor literal {N}
      const litMatch = line.match(/\{(\d+)\}$/);
      if (litMatch) {
        const byteCount = parseInt(litMatch[1]);
        literal = await this.readBytes(byteCount);
        // Na literal komt er een sluit-regel
        continue;
      }

      lines.push(line);
      if (line.startsWith(`${tag} `)) break;
    }

    return { lines, literal };
  }

  async login(user: string, pass: string): Promise<void> {
    const res = await this.command(`LOGIN "${user}" "${pass}"`);
    const ok = res.find(l => l.includes(" OK"));
    if (!ok) throw new Error("IMAP login mislukt: " + (res[res.length - 1] || ""));
  }

  async select(folder: string): Promise<number> {
    const res = await this.command(`SELECT "${folder}"`);
    const status = res[res.length - 1] || "";
    if (/ (NO|BAD) /i.test(status)) {
      throw new Error(`Kan map niet openen: ${folder}`);
    }
    let total = 0;
    for (const line of res) {
      const m = line.match(/\*\s+(\d+)\s+EXISTS/);
      if (m) total = parseInt(m[1]);
    }
    return total;
  }

  // Toggle een IMAP flag (bijv. \Seen) voor een bericht via UID
  async setFlag(uid: number, flag: string, add: boolean): Promise<void> {
    const op = add ? "+FLAGS" : "-FLAGS";
    const res = await this.command(`UID STORE ${uid} ${op} (${flag})`);
    const status = res[res.length - 1] || "";
    if (/ (NO|BAD) /i.test(status)) {
      throw new Error(`STORE mislukt voor UID ${uid}: ${status.trim()}`);
    }
  }

  // Probeer meerdere bekende Trash-map-namen (taal-afhankelijk bij Gmail)
  async selectTrash(): Promise<{ folder: string; total: number }> {
    const candidates = [
      "[Gmail]/Trash",
      "[Gmail]/Prullenbak",
      "[Gmail]/Bin",
      "Trash",
      "Prullenbak",
      "Deleted Messages",
      "Deleted Items",
    ];
    for (const f of candidates) {
      try {
        const total = await this.select(f);
        return { folder: f, total };
      } catch { /* probeer volgende */ }
    }
    throw new Error("Geen Prullenbak-map gevonden op IMAP-server");
  }

  async fetchList(startSeq: number, endSeq: number): Promise<any[]> {
    const res = await this.command(`FETCH ${startSeq}:${endSeq} (UID FLAGS ENVELOPE)`);
    const messages: any[] = [];
    let cur: any = null;

    for (const line of res) {
      const fetchMatch = line.match(/^\*\s+(\d+)\s+FETCH\s+\(/);
      if (fetchMatch) {
        if (cur) messages.push(cur);
        cur = { seq: parseInt(fetchMatch[1]) };
      }
      if (!cur) continue;

      const uidMatch = line.match(/UID\s+(\d+)/);
      if (uidMatch) cur.uid = parseInt(uidMatch[1]);

      const flagsMatch = line.match(/FLAGS\s+\(([^)]*)\)/);
      if (flagsMatch) cur.flags = flagsMatch[1].split(/\s+/).filter(Boolean);

      const envMatch = line.match(/ENVELOPE\s+\((.+)\)/);
      if (envMatch) {
        try {
          const env = envMatch[1];
          const dateMatch = env.match(/^"([^"]*)"/);
          if (dateMatch) cur.date = dateMatch[1];

          const subjMatch = env.match(/^"[^"]*"\s+"([^"]*)"/);
          if (subjMatch) cur.subject = decodeImapString(subjMatch[1]);
          else if (env.match(/^"[^"]*"\s+NIL/)) cur.subject = "(geen onderwerp)";

          const fromMatch = env.match(/\(\("?([^"]*)"?\s+NIL\s+"([^"]*)"\s+"([^"]*)"\)\)/);
          if (fromMatch) {
            cur.from = {
              name: decodeImapString(fromMatch[1] === "NIL" ? "" : fromMatch[1]),
              email: `${fromMatch[2]}@${fromMatch[3]}`
            };
          }
        } catch { /* envelope parsing kan falen */ }
      }
    }
    if (cur) messages.push(cur);
    return messages;
  }

  async fetchSingle(uid: number): Promise<string> {
    // Haal maximaal 256KB op (genoeg voor headers + tekst, bijlagen worden afgekapt)
    const { literal } = await this.commandWithLiteral(`UID FETCH ${uid} (BODY.PEEK[]<0.262144>)`);
    return literal;
  }

  async logout(): Promise<void> {
    try {
      await this.command("LOGOUT");
      this.conn.close();
    } catch { /* ignore */ }
  }
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
    const uid = url.searchParams.get("uid");
    const action = url.searchParams.get("action");

    const client = new ImapClient();
    await client.connect(settings.imap_host, settings.imap_port || 993);
    await client.login(settings.email_user, settings.email_pass);

    // ── Flag toggle (mark als gelezen / ongelezen) ──
    if (action === "mark" && uid) {
      const seenParam = url.searchParams.get("seen");
      const add = seenParam === "true" || seenParam === "1";
      console.log(`Marking UID ${uid} in ${folder} as ${add ? "read" : "unread"}`);
      if (folder === "__trash__") {
        await client.selectTrash();
      } else {
        await client.select(folder);
      }
      await client.setFlag(parseInt(uid), "\\Seen", add);
      await client.logout();
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Enkel bericht ophalen met body ──
    if (uid) {
      console.log(`Fetching email UID ${uid} from ${folder}`);
      if (folder === "__trash__") {
        await client.selectTrash();
      } else {
        await client.select(folder);
      }
      const rawMessage = await client.fetchSingle(parseInt(uid));
      await client.logout();

      if (!rawMessage) {
        return new Response(JSON.stringify({ error: "Bericht niet gevonden" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Parse headers voor metadata
      const { headers } = parseMimeMessage(rawMessage);
      const subject = decodeImapString(headers.get("subject") || "");
      const fromHeader = headers.get("from") || "";
      const date = headers.get("date") || "";

      // Parse from header: "Naam <email>" of "email"
      let from = { name: "", email: fromHeader };
      const fromParsed = fromHeader.match(/"?([^"<]*)"?\s*<([^>]+)>/);
      if (fromParsed) {
        from = { name: decodeImapString(fromParsed[1].trim()), email: fromParsed[2] };
      }

      // Extraheer leesbare tekst
      const body = extractTextFromMime(rawMessage);

      return new Response(JSON.stringify({ subject, from, date, body }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Lijst ophalen ──
    console.log(`Fetching ${limit} emails from ${folder} via ${settings.imap_host}`);
    let resolvedFolder = folder;
    let total: number;
    if (folder === "__trash__") {
      const res = await client.selectTrash();
      resolvedFolder = res.folder;
      total = res.total;
      console.log(`Trash resolved to: ${resolvedFolder}`);
    } else {
      total = await client.select(folder);
    }
    let messages: any[] = [];

    if (total > 0) {
      const startSeq = Math.max(1, total - limit + 1);
      messages = await client.fetchList(startSeq, total);
      messages.reverse(); // nieuwste eerst
    }

    await client.logout();

    return new Response(JSON.stringify({
      messages: messages.map(m => ({
        uid: m.uid || m.seq,
        seq: m.seq,
        flags: m.flags || [],
        from: m.from || { name: "", email: "" },
        subject: m.subject || "(geen onderwerp)",
        date: m.date || "",
        read: (m.flags || []).includes("\\Seen"),
      })),
      total,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
