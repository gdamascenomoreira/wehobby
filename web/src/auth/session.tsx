import type { CreateProfile, Profile, UpdateProfile } from '@wehobby/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { checkUsername, createMyProfile, fetchMyProfile, updateMyProfile } from '../api/profile';
import type { AuthClient } from './authClient';

export type SessionStatus = 'loading' | 'signedOut' | 'needsProfile' | 'ready' | 'error';

export interface Session {
  status: SessionStatus;
  /** Set when status is 'ready'. */
  profile: Profile | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  createProfile: (input: CreateProfile) => Promise<Profile>;
  updateProfile: (patch: UpdateProfile) => Promise<Profile>;
  isUsernameAvailable: (username: string) => Promise<boolean>;
}

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return session;
}

interface SessionProviderProps {
  /** Creates the identity provider client. Loaded lazily so tests can pass a fake. */
  createAuthClient: () => Promise<AuthClient>;
  children: ReactNode;
}

/**
 * Signs the user in with Entra External ID and loads their WeHobby profile.
 * A signed in user without a profile still has to finish onboarding.
 */
export function SessionProvider({ createAuthClient, children }: SessionProviderProps) {
  const { i18n } = useTranslation();
  const [client, setClient] = useState<AuthClient | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);

  const applyProfile = useCallback(
    (next: Profile) => {
      setProfile(next);
      setStatus('ready');
      // The language saved in the profile wins over the browser language.
      if (i18n.resolvedLanguage !== next.language) {
        void i18n.changeLanguage(next.language);
      }
    },
    [i18n],
  );

  useEffect(() => {
    let cancelled = false;
    // A function, so TypeScript does not narrow the flag away between awaits.
    const isCancelled = () => cancelled;

    async function start() {
      const auth = await createAuthClient();
      if (isCancelled()) return;
      setClient(auth);
      if (!auth.isSignedIn()) {
        setStatus('signedOut');
        return;
      }
      const mine = await fetchMyProfile(await auth.getAccessToken());
      if (isCancelled()) return;
      if (mine) {
        applyProfile(mine);
      } else {
        setStatus('needsProfile');
      }
    }

    start().catch((error: unknown) => {
      console.error('Could not start the session', error);
      if (!cancelled) setStatus('error');
    });
    return () => {
      cancelled = true;
    };
  }, [createAuthClient, applyProfile]);

  const session = useMemo<Session>(() => {
    function requireClient(): AuthClient {
      if (!client) throw new Error('Session is not ready');
      return client;
    }

    return {
      status,
      profile,
      signIn: () => requireClient().signIn(),
      signOut: () => requireClient().signOut(),
      async createProfile(input) {
        const created = await createMyProfile(await requireClient().getAccessToken(), input);
        applyProfile(created);
        return created;
      },
      async updateProfile(patch) {
        const updated = await updateMyProfile(await requireClient().getAccessToken(), patch);
        applyProfile(updated);
        return updated;
      },
      async isUsernameAvailable(username) {
        const token = await requireClient().getAccessToken();
        return (await checkUsername(token, username)).available;
      },
    };
  }, [client, status, profile, applyProfile]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
