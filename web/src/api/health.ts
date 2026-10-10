import { HealthResponseSchema, type HealthResponse } from '@wehobby/shared';

// Relative URL: the API is served from the same origin (Caddy on the VM, the
// Vite dev server proxy locally), so no API base URL or CORS is needed.
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/health', signal ? { signal } : {});
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return HealthResponseSchema.parse(await response.json());
}
