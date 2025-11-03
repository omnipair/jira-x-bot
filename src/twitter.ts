import { cfg } from "./config";

export async function tweet(text: string) {
  // Debug logging
  console.log("[DEBUG] dryRunTwitter:", cfg.dryRunTwitter);
  console.log("[DEBUG] xAccessToken present:", !!cfg.xAccessToken);
  if (cfg.xAccessToken) {
    console.log("[DEBUG] xAccessToken length:", cfg.xAccessToken.length);
    console.log("[DEBUG] xAccessToken preview:", cfg.xAccessToken.substring(0, 10) + "...");
  }
  
  if (cfg.dryRunTwitter) {
    console.log("[DRY_RUN_TWITTER] Would tweet:", text);
    return { ok: true } as const;
  }
  if (!cfg.xAccessToken) {
    console.error("[X] Missing X_ACCESS_TOKEN");
    return { ok: false, error: "missing_token" } as const;
  }
  
  console.log("[DEBUG] Making Twitter API call with text:", text);
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.xAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Tweet failed:", res.status, res.statusText, json);
    return { ok: false, error: json } as const;
  }
  console.log("Tweet ok:", json);
  return { ok: true, ...json } as const;
}

