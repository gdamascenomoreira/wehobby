import {
  MyLocationSchema,
  PlaceSearchResponseSchema,
  type MyLocation,
  type Place,
  type UpdateMyLocation,
} from '@wehobby/shared';
import { z } from 'zod';
import { apiRequest } from './client';

/** Cities matching the query, in the user's language. */
export async function searchPlaces(
  token: string,
  q: string,
  signal?: AbortSignal,
): Promise<Place[]> {
  const body = await apiRequest(
    `/places/search?q=${encodeURIComponent(q)}`,
    PlaceSearchResponseSchema,
    { token, ...(signal && { signal }) },
  );
  return body.places;
}

/** Sets the user's area from a picked place or a rounded browser position. */
export function updateMyLocation(token: string, input: UpdateMyLocation): Promise<MyLocation> {
  return apiRequest('/me/location', MyLocationSchema, { method: 'PUT', body: input, token });
}

export async function deleteMyLocation(token: string): Promise<void> {
  await apiRequest('/me/location', z.undefined(), { method: 'DELETE', token });
}
