import { Capacitor, registerPlugin } from '@capacitor/core';

interface YouDoFocusSoundPlugin {
  keepAlive(options: { on: boolean }): Promise<void>;
}

const YouDoFocusSound = registerPlugin<YouDoFocusSoundPlugin>('YouDoFocusSound', {
  web: () => ({ async keepAlive() {} }) as YouDoFocusSoundPlugin,
});

/**
 * Android: while a focus sound plays with "Keep playing" on, the session
 * notification becomes a media service, so the phone keeps the app (and the
 * sound) running with the screen off. Nothing to do on the web.
 */
export async function setFocusSoundKeepAlive(on: boolean): Promise<void> {
  if (Capacitor.getPlatform() !== 'android' || !Capacitor.isPluginAvailable('YouDoFocusSound')) return;
  try {
    await YouDoFocusSound.keepAlive({ on });
  } catch {
    /* Android refused (for example, started from the background): the sound still plays while the app is open. */
  }
}
