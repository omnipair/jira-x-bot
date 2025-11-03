import { dbOps } from "./db";

export async function alreadyPosted(dedupId: string): Promise<boolean> {
  if (!dedupId) return false;
  return await dbOps.isPosted(dedupId);
}

export async function markPosted(dedupId: string, issueKey: string, fromStatus: string, toStatus: string): Promise<void> {
  if (!dedupId) return;
  await dbOps.markPosted({ dedupId, issueKey, fromStatus, toStatus });
}
