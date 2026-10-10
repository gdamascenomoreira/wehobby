import { beforeAll, describe, expect, it } from 'vitest';
import { createTokenVerifier, InvalidTokenError, type TokenVerifier } from './auth.js';
import { createTestTokens } from './test/auth.js';
import { testConfig } from './test/config.js';

describe('createTokenVerifier', () => {
  const config = testConfig();
  let tokens: Awaited<ReturnType<typeof createTestTokens>>;
  let verify: TokenVerifier;

  beforeAll(async () => {
    tokens = await createTestTokens(config);
    verify = createTokenVerifier(config.auth, tokens.getSigningKey);
  });

  it('accepts a valid token and returns the user object id', async () => {
    const oid = crypto.randomUUID();

    await expect(verify(await tokens.sign({ oid }))).resolves.toEqual({ oid });
  });

  it('accepts the scope among several scopes', async () => {
    const token = await tokens.sign({ scope: 'openid access_as_user offline_access' });

    await expect(verify(token)).resolves.toHaveProperty('oid');
  });

  it.each([
    ['expired', { expiresIn: '-1m' }],
    ['issued for another API', { audience: '00000000-0000-4000-8000-0000000000ff' }],
    ['issued by another tenant', { issuer: 'https://evil.ciamlogin.com/x/v2.0' }],
    ['missing the API scope', { scope: 'openid' }],
    ['signed with an untrusted key', { foreignKey: true }],
    ['missing the oid claim', { oid: '' }],
  ])('rejects a token %s', async (_case, options) => {
    await expect(verify(await tokens.sign(options))).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('rejects something that is not a JWT', async () => {
    await expect(verify('not-a-token')).rejects.toBeInstanceOf(InvalidTokenError);
  });
});
