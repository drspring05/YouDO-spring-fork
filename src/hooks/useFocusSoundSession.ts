import { useEffect, useState } from 'react';
import type { ActiveSession } from '../types';
import { FOCUS_SOUNDS_EVENT, focusSoundAction, focusSoundPlayer, readFocusSoundPrefs } from '../lib/focusSounds';
import { setFocusSoundKeepAlive } from '../lib/focusSoundKeepAlive';

/** Plays the chosen focus sound with the session: on while it runs, paused with it, gone when it ends. */
export function useFocusSoundSession(activeSession: ActiveSession | null) {
  const [prefs, setPrefs] = useState(readFocusSoundPrefs);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');

  useEffect(() => {
    const onPrefs = () => setPrefs(readFocusSoundPrefs());
    const onVisibility = () => setVisible(document.visibilityState !== 'hidden');
    window.addEventListener(FOCUS_SOUNDS_EVENT, onPrefs);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener(FOCUS_SOUNDS_EVENT, onPrefs);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => focusSoundPlayer.setVolume(prefs.volume), [prefs.volume]);

  const action = focusSoundAction({
    session: !!activeSession,
    paused: !!activeSession?.isPaused,
    sound: prefs.sound,
    visible,
    keepPlaying: prefs.keepPlaying,
  });
  useEffect(() => {
    if (action === 'play' && prefs.sound) void focusSoundPlayer.play(prefs.sound);
    else if (action === 'pause') void focusSoundPlayer.pause();
    else void focusSoundPlayer.stop();
  }, [action, prefs.sound]);

  const keepAlive = action === 'play' && prefs.keepPlaying;
  useEffect(() => {
    void setFocusSoundKeepAlive(keepAlive);
  }, [keepAlive]);
}
