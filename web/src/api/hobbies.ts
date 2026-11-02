import {
  HobbiesResponseSchema,
  MyHobbiesSchema,
  type Hobby,
  type MyHobby,
  type TypeSuggestion,
  type UpdateMyHobbies,
} from '@wehobby/shared';
import { z } from 'zod';
import { apiRequest, ApiRequestError } from './client';

/** The active hobbies and their types, in display order. */
export async function fetchHobbyCatalog(token: string): Promise<Hobby[]> {
  return (await apiRequest('/hobbies', HobbiesResponseSchema, { token })).hobbies;
}

/** The signed in user's hobbies, or null before onboarding. */
export async function fetchMyHobbies(token: string): Promise<MyHobby[] | null> {
  try {
    return (await apiRequest('/me/hobbies', MyHobbiesSchema, { token })).hobbies;
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'not_found') {
      return null;
    }
    throw error;
  }
}

export async function updateMyHobbies(token: string, input: UpdateMyHobbies): Promise<MyHobby[]> {
  const body = await apiRequest('/me/hobbies', MyHobbiesSchema, {
    method: 'PUT',
    body: input,
    token,
  });
  return body.hobbies;
}

/** Accepted with no body, whether the suggestion is new or a duplicate. */
export async function suggestHobbyType(token: string, input: TypeSuggestion): Promise<void> {
  await apiRequest('/hobby-types/suggestions', z.undefined(), {
    method: 'POST',
    body: input,
    token,
  });
}
