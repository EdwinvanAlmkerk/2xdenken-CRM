import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // E-mail settings ophalen
    const { data: settings, error: settingsError } = await supabase
      .from("email_settings")
      .select("*")
      .eq("id", "main")
      .single();

    if (settingsError || !settings?.imap_host) {
      return new Response(JSON.stringify({ error: "E-mailinstellingen niet geconfigureerd" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Parameters
    const url = new URL(req.url);
    const folder = url.searchParams.get("folder") || "INBOX";
    const limit = parseInt(url.searchParams.get("limit") || "50");

    // IMAP verbinding
    const { ImapClient } = await import("https://deno.land/x/imap@v0.4.0/mod.ts");

    const client = new ImapClient({
      hostname: settings.imap_host,
      port: settings.imap_port || 993,
      username: settings.email_user,
      password: settings.email_pass,
      tls: true,
    });

    await client.connect();
    await client.login();
    await client.select(folder);

    // Haal headers op van de laatste N berichten
    const status = await client.status(folder, ["MESSAGES"]);
    const totalMessages = status.messages || 0;
    const startSeq = Math.max(1, totalMessages - limit + 1);

    const messages: any[] = [];

    if (totalMessages > 0) {
      const fetched = await client.fetch(`${startSeq}:*`, {
        envelope: true,
        bodyStructure: true,
        flags: true,
      });

      for (const msg of fetched) {
        const env = msg.envelope;
        messages.push({
          seq: msg.seq,
          uid: msg.uid,
          flags: msg.flags,
          from: env?.from?.[0] ? { name: env.from[0].name || '', email: `${env.from[0].mailbox}@${env.from[0].host}` } : null,
          to: env?.to?.map((t: any) => ({ name: t.name || '', email: `${t.mailbox}@${t.host}` })) || [],
          subject: env?.subject || '(geen onderwerp)',
          date: env?.date || null,
          messageId: env?.messageId || null,
        });
      }
    }

    await client.logout();

    // Nieuwste eerst
    messages.reverse();

    return new Response(JSON.stringify({ messages, total: totalMessages }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
