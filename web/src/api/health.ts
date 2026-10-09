import { HealthResponseSchema, type HealthResponse } from '@wehobby/shared';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${API_URL}/health`, signal ? { signal } : {});
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return HealthResponseSchema.parse(await response.json());
}
