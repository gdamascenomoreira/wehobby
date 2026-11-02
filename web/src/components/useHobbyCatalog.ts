import type { Hobby } from '@wehobby/shared';
import { useEffect, useState } from 'react';
import { useSession } from '../auth/session';

export type HobbyCatalog =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; hobbies: Hobby[] };

/** Loads the active hobbies and their types once, for the hobby picker. */
export function useHobbyCatalog(): HobbyCatalog {
  const { fetchHobbyCatalog } = useSession();
  const [catalog, setCatalog] = useState<HobbyCatalog>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchHobbyCatalog().then(
      (hobbies) => {
        if (!cancelled) setCatalog({ status: 'ready', hobbies });
      },
      (error: unknown) => {
        console.error('Could not load the hobbies', error);
        if (!cancelled) setCatalog({ status: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
    // The session object changes on every state change; load the catalog only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return catalog;
}
