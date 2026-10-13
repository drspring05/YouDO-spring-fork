import { useCallback, useEffect, useState } from 'react';
import {
  CLOSED_PRIVATE_HUB,
  PRIVATE_HUB_ACCESS_EVENT,
  canOpenPrivateHub,
  fetchPrivateHubAccess,
  parsePrivateHubAccess,
  type PrivateHubAccess,
} from '../lib/privateHubAccess';

/** The Private Hub switch for the signed-in account; closed until the server says otherwise. */
export function usePrivateHubAccess(userId: string | undefined) {
  const [access, setAccess] = useState<PrivateHubAccess>(CLOSED_PRIVATE_HUB);

  const refresh = useCallback(async () => {
    if (!userId) {
      setAccess(CLOSED_PRIVATE_HUB);
      return;
    }
    setAccess(await fetchPrivateHubAccess());
  }, [userId]);

  useEffect(() => {
    void refresh();
    if (!userId) return;
    const onChanged = (event: Event) => setAccess(parsePrivateHubAccess((event as CustomEvent).detail));
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener(PRIVATE_HUB_ACCESS_EVENT, onChanged);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(PRIVATE_HUB_ACCESS_EVENT, onChanged);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, refresh]);

  return { ...access, open: canOpenPrivateHub(access), refresh };
}
