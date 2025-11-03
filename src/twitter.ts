import OAuth from "oauth-1.0a";
import crypto from "crypto";
import { cfg } from "./config";

// Initialize OAuth 1.0a
const oauth = new OAuth({
  consumer: {
    key: cfg.xApiKey,
    secret: cfg.xApiSecret,
  },
  signature_method: "HMAC-SHA1",
  hash_function(baseString, key) {
    return crypto.createHmac("sha1", key).update(baseString).digest("base64");
  },
});

export async function tweet(text: string) {
  if (cfg.dryRunTwitter) {
    console.log("[DRY_RUN_TWITTER] Would tweet:", text);
    return { ok: true } as const;
  }

  // Validate all OAuth credentials are present
  if (!cfg.xApiKey || !cfg.xApiSecret || !cfg.xAccessToken || !cfg.xAccessTokenSecret) {
    console.error("[X] Missing OAuth credentials. Required:");
    console.error("[X]   X_API_KEY:", !!cfg.xApiKey);
    console.error("[X]   X_API_SECRET:", !!cfg.xApiSecret);
    console.error("[X]   X_ACCESS_TOKEN:", !!cfg.xAccessToken);
    console.error("[X]   X_ACCESS_TOKEN_SECRET:", !!cfg.xAccessTokenSecret);
    return { ok: false, error: "missing_oauth_credentials" } as const;
  }

  const url = "https://api.twitter.com/2/tweets";
  const requestData = {
    url,
    method: "POST",
  };

  // Generate OAuth 1.0a authorization header
  const token = {
    key: cfg.xAccessToken,
    secret: cfg.xAccessTokenSecret,
  };

  const authData = oauth.authorize(requestData, token);
  const authHeader = oauth.toHeader(authData);

  console.log("[DEBUG] Making Twitter API v2 call with OAuth 1.0a");
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("Tweet failed:", res.status, res.statusText);
      console.error("Error details:", JSON.stringify(json, null, 2));

      if (res.status === 401) {
        console.error("[X] 401 Unauthorized - OAuth credentials are invalid");
        console.error("[X] Verify your 4 tokens in Railway:");
        console.error("[X]   - X_API_KEY (Consumer Key)");
        console.error("[X]   - X_API_SECRET (Consumer Secret)");
        console.error("[X]   - X_ACCESS_TOKEN");
        console.error("[X]   - X_ACCESS_TOKEN_SECRET");
      }

      return { ok: false, error: json } as const;
    }

    console.log("Tweet ok:", json);
    return { ok: true, ...json } as const;
  } catch (e: any) {
    console.error("Tweet network error:", e?.message || e);
    return { ok: false, error: e?.message || String(e) } as const;
  }
}