import { describe, expect, it } from 'vitest';
import { CreateProfileSchema, UpdateProfileSchema, UsernameSchema } from './profile.js';

const validProfile = {
  username: 'giovanna_crochet',
  displayName: 'Giovanna',
  language: 'pt',
  ageConfirmed: true,
};

describe('UsernameSchema', () => {
  it('trims and lowercases the username', () => {
    expect(UsernameSchema.parse('  Giovanna_Crochet ')).toBe('giovanna_crochet');
  });

  it.each(['ab', 'a'.repeat(31), 'giovanna.crochet', 'giovanna crochet', 'joão'])(
    'rejects %j',
    (username) => {
      expect(UsernameSchema.safeParse(username).success).toBe(false);
    },
  );

  it('rejects reserved usernames in any case', () => {
    expect(UsernameSchema.safeParse('Admin').success).toBe(false);
    expect(UsernameSchema.safeParse('wehobby').success).toBe(false);
  });
});

describe('CreateProfileSchema', () => {
  it('accepts a valid profile', () => {
    expect(CreateProfileSchema.parse(validProfile)).toEqual(validProfile);
  });

  it('requires the 16+ confirmation', () => {
    expect(CreateProfileSchema.safeParse({ ...validProfile, ageConfirmed: false }).success).toBe(
      false,
    );
    const withoutAge = { ...validProfile, ageConfirmed: undefined };
    expect(CreateProfileSchema.safeParse(withoutAge).success).toBe(false);
  });

  it('rejects unknown fields, so clients cannot set ids or owners', () => {
    expect(CreateProfileSchema.safeParse({ ...validProfile, id: 'x' }).success).toBe(false);
  });

  it('rejects a bio over 160 characters and an empty display name', () => {
    expect(CreateProfileSchema.safeParse({ ...validProfile, bio: 'a'.repeat(161) }).success).toBe(
      false,
    );
    expect(CreateProfileSchema.safeParse({ ...validProfile, displayName: '   ' }).success).toBe(
      false,
    );
  });
});

describe('UpdateProfileSchema', () => {
  it('accepts a partial update', () => {
    expect(UpdateProfileSchema.parse({ bio: 'Amigurumi lover' })).toEqual({
      bio: 'Amigurumi lover',
    });
  });

  it('rejects an empty update', () => {
    expect(UpdateProfileSchema.safeParse({}).success).toBe(false);
  });

  it('does not allow changing the username', () => {
    expect(UpdateProfileSchema.safeParse({ username: 'other' }).success).toBe(false);
  });
});
