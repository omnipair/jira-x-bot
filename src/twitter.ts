import { cfg } from "./config";

export async function tweet(text: string) {
  if (cfg.dryRun) {
    console.log("[DRY_RUN] Would tweet:", text);
    return { ok: true } as const;
  }
  if (!cfg.xAccessToken) {
    console.error("[X] Missing X_ACCESS_TOKEN");
    return { ok: false, error: "missing_token" } as const;
  }
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

