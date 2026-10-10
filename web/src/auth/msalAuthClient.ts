import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';
import { PublicConfigSchema, type PublicConfig } from '@wehobby/shared';
import { apiRequest } from '../api/client';
import type { AuthClient } from './authClient';

let instance: Promise<AuthClient> | undefined;

/**
 * The MSAL client, configured from GET /api/config. Created once per page, so
 * the redirect back from sign in is only processed once (also under StrictMode).
 */
export function createMsalAuthClient(): Promise<AuthClient> {
  instance ??= createClient();
  return instance;
}

async function createClient(): Promise<AuthClient> {
  const config: PublicConfig = await apiRequest('/config', PublicConfigSchema);
  const { clientId, authority, apiScope } = config.auth;
  const scopes = [apiScope];

  const msal = new PublicClientApplication({
    auth: {
      clientId,
      authority,
      // External ID authorities are not on MSAL's built in list.
      knownAuthorities: [new URL(authority).host],
      redirectUri: `${window.location.origin}/`,
      postLogoutRedirectUri: `${window.location.origin}/`,
    },
    // Keeps users signed in when the installed PWA is closed and reopened.
    cache: { cacheLocation: 'localStorage' },
  });

  await msal.initialize();
  const result = await msal.handleRedirectPromise();
  if (result?.account) {
    msal.setActiveAccount(result.account);
  }

  function account(): AccountInfo | null {
    return msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
  }

  return {
    isSignedIn: () => account() !== null,

    signIn: () => msal.loginRedirect({ scopes }),

    signOut: () => {
      const current = account();
      return msal.logoutRedirect(current ? { account: current } : {});
    },

    getAccessToken: async () => {
      const current = account();
      if (!current) {
        throw new Error('Not signed in');
      }
      try {
        return (await msal.acquireTokenSilent({ scopes, account: current })).accessToken;
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          // The session expired: sign in again, then come back.
          await msal.acquireTokenRedirect({ scopes, account: current });
        }
        throw error;
      }
    },
  };
}
