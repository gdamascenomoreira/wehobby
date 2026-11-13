import { z } from 'zod';

/**
 * Azure Instance Metadata Service: answers only from inside the VM, with a
 * token for the VM's system assigned managed identity.
 * https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/how-to-use-vm-token
 */
/** Anything that gives an Entra ID access token for a scope (the VM managed identity). */
export interface TokenSource {
  getToken(scope: string): Promise<{ token: string } | null>;
}

export const IMDS_TOKEN_URL = 'http://169.254.169.254/metadata/identity/oauth2/token';
const IMDS_API_VERSION = '2018-02-01';
const IMDS_TIMEOUT_MS = 2000;
/** Ask for a new token this long before the cached one expires. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

const ImdsTokenSchema = z.object({
  access_token: z.string().min(1),
  /** Seconds since the epoch, as a string. */
  expires_on: z.coerce.number().int().positive(),
});

export interface ManagedIdentityOptions {
  fetch?: typeof fetch;
  now?: () => number;
}

/**
 * Gets Entra ID tokens for the VM managed identity from IMDS and caches each
 * one until shortly before it expires. Written by hand instead of using
 * `@azure/identity`, which would only be used for this; it works on any Azure VM
 * and, with a different URL, would be the place to add other hosts.
 */
export function createManagedIdentityCredential(options: ManagedIdentityOptions = {}): TokenSource {
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { token: string; expiresAt: number }>();

  return {
    async getToken(scope) {
      const cached = cache.get(scope);
      if (cached && cached.expiresAt - REFRESH_MARGIN_MS > now()) {
        return { token: cached.token };
      }

      // IMDS takes a resource, not a scope: https://atlas.microsoft.com/.default -> https://atlas.microsoft.com/
      const resource = scope.replace(/\.default$/, '');
      const url = new URL(IMDS_TOKEN_URL);
      url.search = new URLSearchParams({ 'api-version': IMDS_API_VERSION, resource }).toString();

      const response = await doFetch(url, {
        headers: { Metadata: 'true' },
        signal: AbortSignal.timeout(IMDS_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`Managed identity endpoint answered ${String(response.status)}`);
      }
      const body = ImdsTokenSchema.safeParse(await response.json().catch(() => undefined));
      if (!body.success) {
        throw new Error('Unexpected managed identity token response');
      }

      const token = { token: body.data.access_token, expiresAt: body.data.expires_on * 1000 };
      cache.set(scope, token);
      return { token: token.token };
    },
  };
}
