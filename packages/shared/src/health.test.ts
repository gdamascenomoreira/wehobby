import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from './health.js';

describe('HealthResponseSchema', () => {
  it('accepts a valid health response', () => {
    expect(HealthResponseSchema.parse({ status: 'ok', version: '1.2.3' })).toEqual({
      status: 'ok',
      version: '1.2.3',
    });
  });

  it('rejects an unknown status', () => {
    expect(HealthResponseSchema.safeParse({ status: 'down', version: '1.2.3' }).success).toBe(
      false,
    );
  });

  it('rejects an empty version', () => {
    expect(HealthResponseSchema.safeParse({ status: 'ok', version: '' }).success).toBe(false);
  });
});
