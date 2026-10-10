/**
 * What the app needs from the identity provider. The real implementation uses
 * MSAL with Entra External ID (msalAuthClient.ts); tests use a fake.
 */
export interface AuthClient {
  /** True when a user is signed in, after finishing any redirect back from sign in. */
  isSignedIn: () => boolean;
  /** Redirects to the hosted sign in or sign up page (email or Google). */
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** An access token for the API. May redirect to sign in again if the session expired. */
  getAccessToken: () => Promise<string>;
}
