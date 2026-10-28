import { HealthResponseSchema, type HealthResponse } from '@wehobby/shared';
import { apiRequest } from './client';

export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiRequest('/health', HealthResponseSchema, signal ? { signal } : {});
}
