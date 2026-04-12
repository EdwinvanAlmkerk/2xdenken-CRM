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

    // Supabase client om settings op te halen
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // E-mail settings ophalen
    const { data: settings, error: settingsError } = await supabase
      .from("email_settings")
      .select("*")
      .eq("id", "main")
      .single();

    if (settingsError || !settings?.smtp_host) {
      return new Response(JSON.stringify({ error: "E-mailinstellingen niet geconfigureerd" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Request body
    const { to, subject, body, html } = await req.json();
    if (!to || !subject) {
      return new Response(JSON.stringify({ error: "to en subject zijn verplicht" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // SMTP verbinding via Deno native
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

    const client = new SMTPClient({
      connection: {
        hostname: settings.smtp_host,
        port: settings.smtp_port || 587,
        tls: true,
        auth: {
          username: settings.email_user,
          password: settings.email_pass,
        },
      },
    });

    const fromName = settings.email_from || settings.email_user;

    await client.send({
      from: `${fromName} <${settings.email_user}>`,
      to,
      subject,
      content: body || "",
      html: html || undefined,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
