import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bouw MIME bericht (plain text of multipart met HTML)
function buildMessage(from: string, to: string, subject: string, body: string, html?: string): string {
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const date = new Date().toUTCString();
  const escapedBody = body.replace(/^\./gm, "..");

  if (html) {
    const boundary = "----=_Part_" + Date.now();
    const escapedHtml = html.replace(/^\./gm, "..");
    return [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      `Date: ${date}`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      escapedBody,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      escapedHtml,
      ``,
      `--${boundary}--`,
    ].join("\r\n");
  }

  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    `Date: ${date}`,
    ``,
    escapedBody,
  ].join("\r\n");
}

// Minimale SMTP client met Deno TCP
async function sendSmtp(
  host: string, port: number, user: string, pass: string,
  from: string, to: string, subject: string, body: string, html?: string
): Promise<void> {
  const conn = port === 465
    ? await Deno.connectTls({ hostname: host, port })
    : await Deno.connect({ hostname: host, port });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  async function read(): Promise<string> {
    const buf = new Uint8Array(4096);
    const n = await conn.read(buf);
    return n ? decoder.decode(buf.subarray(0, n)) : "";
  }

  async function write(cmd: string): Promise<string> {
    await conn.write(encoder.encode(cmd + "\r\n"));
    return await read();
  }

  await read(); // Greeting
  let res = await write("EHLO localhost");

  if (port !== 465 && res.includes("STARTTLS")) {
    await write("STARTTLS");
    const tlsConn = await Deno.startTls(conn, { hostname: host });

    const tlsRead = async (): Promise<string> => {
      const buf = new Uint8Array(4096);
      const n = await tlsConn.read(buf);
      return n ? decoder.decode(buf.subarray(0, n)) : "";
    };
    const tlsWrite = async (cmd: string): Promise<string> => {
      await tlsConn.write(encoder.encode(cmd + "\r\n"));
      return await tlsRead();
    };

    await tlsWrite("EHLO localhost");
    await tlsWrite("AUTH LOGIN");
    await tlsWrite(btoa(user));
    const authRes = await tlsWrite(btoa(pass));
    if (!authRes.startsWith("235")) throw new Error("SMTP auth mislukt: " + authRes.trim());

    await tlsWrite(`MAIL FROM:<${from}>`);
    await tlsWrite(`RCPT TO:<${to}>`);
    await tlsWrite("DATA");

    const msg = buildMessage(from, to, subject, body, html);
    await tlsConn.write(encoder.encode(msg + "\r\n.\r\n"));
    const dataRes = await tlsRead();
    if (!dataRes.startsWith("250")) throw new Error("SMTP data mislukt: " + dataRes.trim());

    await tlsWrite("QUIT");
    tlsConn.close();
  } else {
    await write("AUTH LOGIN");
    await write(btoa(user));
    const authRes = await write(btoa(pass));
    if (!authRes.startsWith("235")) throw new Error("SMTP auth mislukt: " + authRes.trim());

    await write(`MAIL FROM:<${from}>`);
    await write(`RCPT TO:<${to}>`);
    await write("DATA");

    const msg = buildMessage(from, to, subject, body, html);
    await conn.write(encoder.encode(msg + "\r\n.\r\n"));
    const dataRes = await read();
    if (!dataRes.startsWith("250")) throw new Error("SMTP data mislukt: " + dataRes.trim());

    await write("QUIT");
    conn.close();
  }
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

    if (!settings?.smtp_host) {
      return new Response(JSON.stringify({ error: "SMTP niet geconfigureerd" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { to, subject, body, html } = await req.json();
    if (!to || !subject) {
      return new Response(JSON.stringify({ error: "to en subject zijn verplicht" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const fromAddr = settings.email_user;
    console.log(`Sending to ${to} via ${settings.smtp_host}:${settings.smtp_port}${html ? ' (with HTML)' : ''}`);

    await sendSmtp(
      settings.smtp_host,
      settings.smtp_port || 587,
      settings.email_user,
      settings.email_pass,
      fromAddr, to, subject, body || " ", html || undefined
    );

    console.log(`Email sent successfully to ${to}`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
