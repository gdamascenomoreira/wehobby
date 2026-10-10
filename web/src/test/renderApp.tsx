import type { Profile } from '@wehobby/shared';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { App } from '../App';
import type { AuthClient } from '../auth/authClient';
import { SessionProvider } from '../auth/session';

export const TEST_TOKEN = 'test-access-token';

export const giovanna: Profile = {
  id: '6f1c2d4e-8a9b-4c3d-9e2f-1a2b3c4d5e6f',
  username: 'giovanna_crochet',
  displayName: 'Giovanna',
  bio: '',
  language: 'en',
  createdAt: '2026-10-10T10:00:00.000Z',
};

type Handler = (body: unknown) => Response;

/** Routes keyed by "METHOD /api/path". Unknown routes answer 404. */
export type ApiRoutes = Record<string, Handler>;

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function stubApi(routes: ApiRoutes) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const key = `${init?.method ?? 'GET'} ${url}`;
    const handler = routes[key];
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    return Promise.resolve(
      handler ? handler(body) : json({ error: 'not_found', message: key }, 404),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function fakeAuthClient(signedIn: boolean): AuthClient {
  return {
    isSignedIn: () => signedIn,
    signIn: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => Promise.resolve()),
    getAccessToken: () => Promise.resolve(TEST_TOKEN),
  };
}

export function renderApp({ auth, path = '/' }: { auth: AuthClient; path?: string }) {
  // A stable function, as in main.tsx, so the session starts once.
  const createAuthClient = () => Promise.resolve(auth);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider createAuthClient={createAuthClient}>
        <App />
      </SessionProvider>
    </MemoryRouter>,
  );
}
