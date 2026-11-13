import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const ConfigSchema = z.object({
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  APP_VERSION: z.string().min(1).default('local'),
  /**
   * Comma separated list of origins allowed by CORS. Off when unset: on the VM
   * the web app and the API share one origin behind Caddy.
   */
  CORS_ORIGIN: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    )
    .pipe(z.array(z.url()).min(1))
    .optional(),
  /** Trust X-Forwarded-For from the reverse proxy (Caddy), so rate limits see the client IP. */
  TRUST_PROXY: booleanString,

  /** PostgreSQL connection string, for example postgres://user:password@db:5432/wehobby */
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  /** Directory (tenant) id of the Entra External ID tenant. */
  AUTH_TENANT_ID: z.uuid(),
  /** Subdomain of the tenant: <subdomain>.ciamlogin.com */
  AUTH_TENANT_SUBDOMAIN: z.string().regex(/^[a-z0-9-]+$/),
  /** Application (client) id of the API registration. Tokens must be issued for it. */
  AUTH_API_CLIENT_ID: z.uuid(),
  /** Application (client) id of the web app registration, passed to the browser. */
  AUTH_WEB_CLIENT_ID: z.uuid(),

  /** City search and reverse geocoding. Defaults to `azure` in production, `fake` otherwise. */
  GEOCODER: z.enum(['azure', 'fake']).optional(),
  /** Client id (`uniqueId`) of the Azure Maps account. Required when GEOCODER is `azure`. */
  AZURE_MAPS_CLIENT_ID: z.uuid().optional(),

  /** Photo storage. Defaults to `azure` in production, `fake` (a local folder) otherwise. */
  STORAGE: z.enum(['azure', 'fake']).optional(),
  /** Storage account with the photos container. Required when STORAGE is `azure`. */
  STORAGE_ACCOUNT_NAME: z
    .string()
    .regex(/^[a-z0-9]{3,24}$/)
    .optional(),
  PHOTOS_CONTAINER: z
    .string()
    .regex(/^[a-z0-9-]{3,63}$/)
    .default('photos'),
  /** Folder of the fake storage, relative to the working directory. */
  FAKE_STORAGE_DIR: z.string().min(1).default('.storage'),
});

type RawConfig = z.infer<typeof ConfigSchema>;

export interface AuthConfig {
  issuer: string;
  jwksUri: string;
  audience: string;
  /** Delegated permission the web app must have been granted. */
  requiredScope: string;
  /** Settings the browser needs to sign in (served by GET /api/config). */
  public: { clientId: string; authority: string; apiScope: string };
}

export type GeocoderConfig = { kind: 'fake' } | { kind: 'azure'; mapsClientId: string };

export type StorageConfig =
  { kind: 'fake'; directory: string } | { kind: 'azure'; accountName: string; container: string };

export type Config = Omit<
  RawConfig,
  | 'AUTH_TENANT_ID'
  | 'AUTH_TENANT_SUBDOMAIN'
  | 'AUTH_API_CLIENT_ID'
  | 'AUTH_WEB_CLIENT_ID'
  | 'GEOCODER'
  | 'AZURE_MAPS_CLIENT_ID'
  | 'STORAGE'
  | 'STORAGE_ACCOUNT_NAME'
  | 'PHOTOS_CONTAINER'
  | 'FAKE_STORAGE_DIR'
> & { auth: AuthConfig; geocoder: GeocoderConfig; storage: StorageConfig };

function geocoderConfig(
  nodeEnv: RawConfig['NODE_ENV'],
  geocoder: RawConfig['GEOCODER'],
  mapsClientId: RawConfig['AZURE_MAPS_CLIENT_ID'],
): GeocoderConfig {
  const kind = geocoder ?? (nodeEnv === 'production' ? 'azure' : 'fake');
  if (kind === 'fake') return { kind };
  if (!mapsClientId) {
    throw new Error('AZURE_MAPS_CLIENT_ID is required when GEOCODER is azure');
  }
  return { kind, mapsClientId };
}

function storageConfig(
  nodeEnv: RawConfig['NODE_ENV'],
  storage: Pick<
    RawConfig,
    'STORAGE' | 'STORAGE_ACCOUNT_NAME' | 'PHOTOS_CONTAINER' | 'FAKE_STORAGE_DIR'
  >,
): StorageConfig {
  const kind = storage.STORAGE ?? (nodeEnv === 'production' ? 'azure' : 'fake');
  if (kind === 'fake') {
    // The fake serves unsigned links to anyone, so it never runs in production.
    if (nodeEnv === 'production') {
      throw new Error('STORAGE=fake is not allowed in production');
    }
    return { kind, directory: storage.FAKE_STORAGE_DIR };
  }
  if (!storage.STORAGE_ACCOUNT_NAME) {
    throw new Error('STORAGE_ACCOUNT_NAME is required when STORAGE is azure');
  }
  return { kind, accountName: storage.STORAGE_ACCOUNT_NAME, container: storage.PHOTOS_CONTAINER };
}

export const API_SCOPE_NAME = 'access_as_user';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const {
    AUTH_TENANT_ID: tenantId,
    AUTH_TENANT_SUBDOMAIN: subdomain,
    AUTH_API_CLIENT_ID: apiClientId,
    AUTH_WEB_CLIENT_ID: webClientId,
    GEOCODER: geocoder,
    AZURE_MAPS_CLIENT_ID: mapsClientId,
    STORAGE,
    STORAGE_ACCOUNT_NAME,
    PHOTOS_CONTAINER,
    FAKE_STORAGE_DIR,
    ...rest
  } = ConfigSchema.parse(env);

  return {
    ...rest,
    geocoder: geocoderConfig(rest.NODE_ENV, geocoder, mapsClientId),
    storage: storageConfig(rest.NODE_ENV, {
      STORAGE,
      STORAGE_ACCOUNT_NAME,
      PHOTOS_CONTAINER,
      FAKE_STORAGE_DIR,
    }),
    auth: {
      // Entra External ID endpoints, see docs/scenarios/01-iaas/portal-guide.md step 12.
      issuer: `https://${tenantId}.ciamlogin.com/${tenantId}/v2.0`,
      jwksUri: `https://${subdomain}.ciamlogin.com/${tenantId}/discovery/v2.0/keys`,
      audience: apiClientId,
      requiredScope: API_SCOPE_NAME,
      public: {
        clientId: webClientId,
        authority: `https://${subdomain}.ciamlogin.com/${tenantId}/`,
        apiScope: `api://${apiClientId}/${API_SCOPE_NAME}`,
      },
    },
  };
}
