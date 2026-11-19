// Returns fresh TURN/STUN ICE servers for WebRTC calls.
// Set METERED_DOMAIN (e.g. yourapp.metered.live) + METERED_API_KEY secrets for reliable relays.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  const domain = Deno.env.get("METERED_DOMAIN");
  const key = Deno.env.get("METERED_API_KEY");
  if (domain && key) {
    try {
      const r = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const iceServers = await r.json();
        if (Array.isArray(iceServers) && iceServers.length) return json({ iceServers, source: "metered" });
      }
    } catch (_) { /* fall through */ }
  }
  return json({ iceServers: [], source: "none" });
});
