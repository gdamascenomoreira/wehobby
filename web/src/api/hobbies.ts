import {
  HobbyCatalogSchema,
  ProfileSchema,
  type Hobby,
  type Profile,
  type SetUserHobbies,
} from '@wehobby/shared';
import { apiRequest } from './client';

export async function fetchHobbyCatalog(signal?: AbortSignal): Promise<Hobby[]> {
  return (await apiRequest('/hobbies', HobbyCatalogSchema, { ...(signal && { signal }) })).hobbies;
}

/** Replaces the signed in user's hobbies and returns the updated profile. */
export function setMyHobbies(token: string, input: SetUserHobbies): Promise<Profile> {
  return apiRequest('/me/hobbies', ProfileSchema, { method: 'PUT', body: input, token });
}
