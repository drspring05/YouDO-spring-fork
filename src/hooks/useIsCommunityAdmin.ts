import { useEffect, useState } from 'react';
import { fetchIsCommunityAdmin } from '../lib/communityAdmin';

/** Admin status for the signed-in account; re-checked when the app returns to the foreground. */
export function useIsCommunityAdmin(userId: string | undefined): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      void fetchIsCommunityAdmin().then((admin) => {
        if (!cancelled) setIsAdmin(admin);
      });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  return isAdmin;
}
