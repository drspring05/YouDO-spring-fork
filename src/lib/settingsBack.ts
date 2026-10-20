/**
 * Device Back inside Settings: on a sub-page it returns to the Settings list
 * instead of closing Settings (the list is the new look's home page).
 */
let handler: (() => boolean) | null = null;

export function setSettingsBackHandler(next: (() => boolean) | null): void {
  handler = next;
}

/** True when Settings handled Back itself (and must stay open). */
export function settingsBackStep(): boolean {
  return handler?.() ?? false;
}
