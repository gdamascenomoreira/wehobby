import { describe, expect, it } from 'vitest';
import { SetUserHobbiesSchema } from './hobby.js';

describe('SetUserHobbiesSchema', () => {
  it('accepts hobbies with and without types', () => {
    const input = {
      hobbies: [
        { hobbyId: 'crochet', typeIds: ['amigurumi', 'tapestry'] },
        { hobbyId: 'plants', typeIds: [] },
      ],
    };
    expect(SetUserHobbiesSchema.parse(input)).toEqual(input);
  });

  it.each([
    ['no hobbies', { hobbies: [] }],
    [
      'a repeated hobby',
      {
        hobbies: [
          { hobbyId: 'crochet', typeIds: [] },
          { hobbyId: 'crochet', typeIds: [] },
        ],
      },
    ],
    ['a repeated type', { hobbies: [{ hobbyId: 'crochet', typeIds: ['amigurumi', 'amigurumi'] }] }],
    ['a malformed id', { hobbies: [{ hobbyId: 'Crochet!', typeIds: [] }] }],
    ['missing types', { hobbies: [{ hobbyId: 'crochet' }] }],
    ['unknown fields', { hobbies: [{ hobbyId: 'crochet', typeIds: [], extra: 1 }] }],
  ])('rejects %s', (_case, input) => {
    expect(SetUserHobbiesSchema.safeParse(input).success).toBe(false);
  });
});
