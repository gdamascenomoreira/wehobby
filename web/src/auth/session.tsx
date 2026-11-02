import type {
  CreateProfile,
  Hobby,
  MyHobby,
  Profile,
  TypeSuggestion,
  UpdateMyHobbies,
  UpdateProfile,
} from '@wehobby/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import i18n from '../i18n';
import { ApiRequestError } from '../api/client';
import {
  fetchHobbyCatalog,
  fetchMyHobbies,
  suggestHobbyType,
  updateMyHobbies,
} from '../api/hobbies';
import { checkUsername, createMyProfile, fetchMyProfile, updateMyProfile } from '../api/profile';
import type { AuthClient } from './authClient';

/**
 * 'needsHobbies': the user has a profile but has not picked a hobby yet.
 * 'unavailable': the API answered 503, for example while the database is down.
 */
export type SessionStatus =
  'loading' | 'signedOut' | 'needsProfile' | 'needsHobbies' | 'ready' | 'error' | 'unavailable';

export interface Session {
  status: SessionStatus;
  /** Set when status is 'needsHobbies' or 'ready'. */
  profile: Profile | null;
  /** The user's hobbies; not empty when status is 'ready'. */
  hobbies: MyHobby[];
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  createProfile: (input: CreateProfile) => Promise<Profile>;
  updateProfile: (patch: UpdateProfile) => Promise<Profile>;
  isUsernameAvailable: (username: string) => Promise<boolean>;
  fetchHobbyCatalog: () => Promise<Hobby[]>;
  saveHobbies: (input: UpdateMyHobbies) => Promise<MyHobby[]>;
  suggestType: (input: TypeSuggestion) => Promise<void>;
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
 * A signed in user without a profile, or without hobbies, still has to finish onboarding.
 */
export function SessionProvider({ createAuthClient, children }: SessionProviderProps) {
  const [client, setClient] = useState<AuthClient | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hobbies, setHobbies] = useState<MyHobby[]>([]);

  const applyProfile = useCallback((next: Profile) => {
    setProfile(next);
    // The language saved in the profile wins over the browser language. This uses the
    // i18n instance directly: the one from useTranslation changes on every language
    // switch, which would restart the session and undo the switch.
    if (i18n.resolvedLanguage !== next.language) {
      void i18n.changeLanguage(next.language);
    }
  }, []);

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
      const token = await auth.getAccessToken();
      const mine = await fetchMyProfile(token);
      if (isCancelled()) return;
      if (!mine) {
        setStatus('needsProfile');
        return;
      }
      const myHobbies = (await fetchMyHobbies(token)) ?? [];
      if (isCancelled()) return;
      applyProfile(mine);
      setHobbies(myHobbies);
      setStatus(myHobbies.length > 0 ? 'ready' : 'needsHobbies');
    }

    start().catch((error: unknown) => {
      console.error('Could not start the session', error);
      if (cancelled) return;
      const unavailable = error instanceof ApiRequestError && error.status === 503;
      setStatus(unavailable ? 'unavailable' : 'error');
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
      hobbies,
      signIn: () => requireClient().signIn(),
      signOut: () => requireClient().signOut(),
      async createProfile(input) {
        const created = await createMyProfile(await requireClient().getAccessToken(), input);
        applyProfile(created);
        // A new profile has no hobbies yet: the hobby step comes next.
        setHobbies([]);
        setStatus('needsHobbies');
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
      async fetchHobbyCatalog() {
        return fetchHobbyCatalog(await requireClient().getAccessToken());
      },
      async saveHobbies(input) {
        const saved = await updateMyHobbies(await requireClient().getAccessToken(), input);
        setHobbies(saved);
        setStatus('ready');
        return saved;
      },
      async suggestType(input) {
        await suggestHobbyType(await requireClient().getAccessToken(), input);
      },
    };
  }, [client, status, profile, hobbies, applyProfile]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
