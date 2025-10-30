import http from "http";
import crypto from "crypto";

const CLIENT_ID = process.env.X_CLIENT_ID;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET; // optional: if present, we'll use Basic auth
const REDIRECT_URI = "http://localhost:9876/callback";
const SCOPES = ["tweet.write","tweet.read","users.read"].join(" ");
if (!CLIENT_ID) { console.error("Set X_CLIENT_ID env var"); process.exit(1); }

function b64url(input) {
  return input.toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}
const codeVerifier = b64url(crypto.randomBytes(32));
const codeChallenge = b64url(crypto.createHash("sha256").update(codeVerifier).digest());
const state = b64url(crypto.randomBytes(16));

const params = new URLSearchParams({
  response_type: "code",
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  scope: SCOPES,
  state,
  code_challenge: codeChallenge,
  code_challenge_method: "S256",
});
const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
console.log("Open this URL in your browser:\n\n", authUrl, "\n");
// Try to auto-open the browser on Linux/macOS/Windows
const opener = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
const spawn = (await import("child_process")).spawn;
try { spawn(opener, [authUrl], { stdio: "ignore", shell: true }).unref(); } catch {}



const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith("/callback")) { res.writeHead(404); return res.end(); }
  const u = new URL(req.url, REDIRECT_URI);
  if (u.searchParams.get("error")) {
    console.error("Auth error:", u.searchParams.get("error"), u.searchParams.get("error_description"));
    res.writeHead(400); res.end("Auth error. Check terminal."); server.close(); return;
  }
  if (u.searchParams.get("state") !== state) { res.writeHead(400); res.end("State mismatch"); server.close(); return; }
  const code = u.searchParams.get("code");
  res.end("Code received. You can close this tab.");
  server.close();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  if (CLIENT_SECRET) {
    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
    Object.assign(headers, { Authorization: `Basic ${basic}` });
  }
  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers,
    body
  });
  const json = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok) {
    console.error("Token exchange failed:", tokenRes.status, json);
    process.exit(1);
  }
  console.log("\naccess_token:\n", json.access_token);
  console.log("scope:", json.scope);
  console.log("token_type:", json.token_type);
  console.log("\nStore this in .env as X_ACCESS_TOKEN");

  // Optional: validate token can access your user
  const me = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${json.access_token}` }
  });
  const meJson = await me.json().catch(() => ({}));
  console.log("\n/users/me status:", me.status, meJson);
});
server.listen(9876, () => console.log("Waiting on http://localhost:9876/callback ..."));