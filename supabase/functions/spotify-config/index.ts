// Returns the PUBLIC Spotify client id (needed for the browser PKCE login). Never returns the secret.
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const clientId = (Deno.env.get("SPOTIFY_CLIENT_ID") ?? "").trim();
  return new Response(JSON.stringify({ clientId: clientId || null }), { headers: { ...cors, "Content-Type": "application/json" } });
});
