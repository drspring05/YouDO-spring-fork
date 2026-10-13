/**
 * "Open a chat with this person" from outside the Private Hub (a Public Board
 * profile, a notification tap). The request survives until the Private Hub
 * mounts and takes it, so switching tabs first is fine.
 */
export const OPEN_DM_EVENT = 'youdo-open-dm';

let pendingUserId: string | null = null;

export function requestOpenDm(userId: string): void {
  pendingUserId = userId;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OPEN_DM_EVENT, { detail: userId }));
}

/** Returns and clears the waiting request, if any. */
export function takePendingDm(): string | null {
  const id = pendingUserId;
  pendingUserId = null;
  return id;
}
