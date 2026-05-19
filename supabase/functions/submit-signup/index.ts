// submit-signup — cold-traffic signup-flow lead capture.
//
// verify_jwt is FALSE: cold public traffic has no session. The function does
// its own validation, honeypot check and light per-IP rate limiting, and
// writes with the service role so anon never touches the table directly.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v: unknown, max: number): string | null {
  const s = (typeof v === "string" ? v : "").trim();
  return s ? s.slice(0, max) : null;
}
function intOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;
}
function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // -- complete: mark a prospect as having finished the final CTA -----------
  if (body.action === "complete") {
    const id = str(body.id, 64);
    if (!id) return json({ error: "missing_id" }, 400);
    const { error } = await supabase
      .from("signup_submissions")
      .update({ signed_up_at: new Date().toISOString() })
      .eq("id", id)
      .is("signed_up_at", null);
    if (error) return json({ error: "update_failed" }, 500);
    return json({ ok: true });
  }

  // -- lead: insert (or partial exit-intent) capture ------------------------
  const trade = str(body.trade, 120);
  const serviceArea = str(body.serviceArea, 160);
  const email = (str(body.contactEmail, 200) ?? "").toLowerCase();

  if (!trade || !serviceArea) return json({ error: "missing_brief" }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);

  // honeypot — bots fill hidden fields; drop silently with a fake id.
  if (body.company_website) return json({ ok: true, id: crypto.randomUUID() });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = await sha256(ip + "|webnua-signup");

  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await supabase
    .from("signup_submissions")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if ((count ?? 0) >= 8) return json({ error: "rate_limited" }, 429);

  const colors = Array.isArray(body.brandColors)
    ? (body.brandColors as unknown[])
        .filter((c) => typeof c === "string" && /^#[0-9a-fA-F]{3,8}$/.test(c))
        .slice(0, 3)
    : [];

  const { data, error } = await supabase
    .from("signup_submissions")
    .insert({
      trade,
      service_area: serviceArea,
      business_name: str(body.businessName, 160),
      main_service: str(body.mainService, 200),
      brand_colors: colors,
      contact_name: str(body.contactName, 160),
      contact_email: email,
      contact_phone: str(body.contactPhone, 60),
      guaranteed_leads: intOrNull(body.guaranteedLeads),
      base_leads_estimate: intOrNull(body.baseLeadsEstimate),
      ad_spend_min: numOrNull(body.adSpendMin),
      ad_spend_max: numOrNull(body.adSpendMax),
      ip_hash: ipHash,
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400),
      meta: typeof body.meta === "object" && body.meta ? body.meta : {},
    })
    .select("id")
    .single();

  if (error) return json({ error: "insert_failed" }, 500);
  return json({ ok: true, id: data.id });
});
