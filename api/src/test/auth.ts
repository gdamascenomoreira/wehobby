import { generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import type { Config } from '../config.js';

export interface TestTokenOptions {
  oid?: string;
  scope?: string;
  audience?: string;
  issuer?: string;
  expiresIn?: string;
  /** Sign with a key the API does not trust. */
  foreignKey?: boolean;
}

/**
 * Signs access tokens the way Entra External ID does (RS256, `oid`, `scp`),
 * with a local key pair instead of the tenant's keys.
 */
export async function createTestTokens(config: Config) {
  const trusted = await generateKeyPair('RS256');
  const foreign = await generateKeyPair('RS256');

  const getSigningKey: JWTVerifyGetKey = () => Promise.resolve(trusted.publicKey);

  async function sign(options: TestTokenOptions = {}): Promise<string> {
    const jwt = new SignJWT({
      scp: options.scope ?? config.auth.requiredScope,
      ...(options.oid !== '' && { oid: options.oid ?? crypto.randomUUID() }),
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setIssuer(options.issuer ?? config.auth.issuer)
      .setAudience(options.audience ?? config.auth.audience)
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? '5m');
    return jwt.sign(options.foreignKey ? foreign.privateKey : trusted.privateKey);
  }

  return { getSigningKey, sign };
}

export function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}
