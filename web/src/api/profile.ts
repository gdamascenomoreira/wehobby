import {
  ProfileSchema,
  UsernameAvailabilitySchema,
  type CreateProfile,
  type Profile,
  type UpdateProfile,
  type UsernameAvailability,
} from '@wehobby/shared';
import { apiRequest, ApiRequestError } from './client';

/** The signed in user's profile, or null before onboarding. */
export async function fetchMyProfile(token: string): Promise<Profile | null> {
  try {
    return await apiRequest('/me', ProfileSchema, { token });
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'not_found') {
      return null;
    }
    throw error;
  }
}

export function createMyProfile(token: string, input: CreateProfile): Promise<Profile> {
  return apiRequest('/me', ProfileSchema, { method: 'POST', body: input, token });
}

export function updateMyProfile(token: string, patch: UpdateProfile): Promise<Profile> {
  return apiRequest('/me', ProfileSchema, { method: 'PATCH', body: patch, token });
}

export function checkUsername(token: string, username: string): Promise<UsernameAvailability> {
  return apiRequest(`/usernames/${encodeURIComponent(username)}`, UsernameAvailabilitySchema, {
    token,
  });
}
