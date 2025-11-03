import { dbOps } from "./db";

export function alreadyPosted(dedupId: string): boolean {
  if (!dedupId) return false;
  return dbOps.isPosted(dedupId);
}

export function markPosted(dedupId: string, issueKey: string, fromStatus: string, toStatus: string): void {
  if (!dedupId) return;
  dbOps.markPosted({ dedupId, issueKey, fromStatus, toStatus });
}
