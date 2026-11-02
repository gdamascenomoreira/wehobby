import { describe, expect, it } from 'vitest';
import { TypeSuggestionSchema, UpdateMyHobbiesSchema } from './hobbies.js';

describe('UpdateMyHobbiesSchema', () => {
  it('accepts hobbies with and without types', () => {
    const selection = {
      hobbies: [
        { hobbyId: 'crochet', typeIds: ['amigurumi', 'granny_squares'] },
        { hobbyId: 'plants', typeIds: [] },
      ],
    };
    expect(UpdateMyHobbiesSchema.parse(selection)).toEqual(selection);
  });

  it('rejects an empty selection', () => {
    expect(UpdateMyHobbiesSchema.safeParse({ hobbies: [] }).success).toBe(false);
  });

  it('rejects the same hobby twice', () => {
    const hobbies = [
      { hobbyId: 'crochet', typeIds: [] },
      { hobbyId: 'crochet', typeIds: ['amigurumi'] },
    ];
    expect(UpdateMyHobbiesSchema.safeParse({ hobbies }).success).toBe(false);
  });

  it('rejects the same type twice in a hobby', () => {
    const hobbies = [{ hobbyId: 'crochet', typeIds: ['amigurumi', 'amigurumi'] }];
    expect(UpdateMyHobbiesSchema.safeParse({ hobbies }).success).toBe(false);
  });

  it.each(['Crochet', 'cro chet', '../users', ''])('rejects the id %j', (hobbyId) => {
    expect(UpdateMyHobbiesSchema.safeParse({ hobbies: [{ hobbyId, typeIds: [] }] }).success).toBe(
      false,
    );
  });

  it('rejects fields the client may not set', () => {
    const hobbies = [{ hobbyId: 'crochet', typeIds: [], userId: crypto.randomUUID() }];
    expect(UpdateMyHobbiesSchema.safeParse({ hobbies }).success).toBe(false);
  });
});

describe('TypeSuggestionSchema', () => {
  it('trims the name', () => {
    expect(TypeSuggestionSchema.parse({ hobbyId: 'crochet', name: '  Tunisian  ' })).toEqual({
      hobbyId: 'crochet',
      name: 'Tunisian',
    });
  });

  it.each(['a', '   a   ', 'x'.repeat(41)])('rejects the name %j', (name) => {
    expect(TypeSuggestionSchema.safeParse({ hobbyId: 'crochet', name }).success).toBe(false);
  });

  it('accepts a 40 character name', () => {
    expect(
      TypeSuggestionSchema.safeParse({ hobbyId: 'crochet', name: 'x'.repeat(40) }).success,
    ).toBe(true);
  });
});
