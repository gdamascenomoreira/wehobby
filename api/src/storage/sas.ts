import { createHmac } from 'node:crypto';

/**
 * Blob service version for both the REST calls and the SAS links. Its user
 * delegation SAS format is the one documented below; newer versions add
 * fields, so change the string to sign together with this value.
 */
export const STORAGE_API_VERSION = '2022-11-02';

/** Response of Get User Delegation Key, signed with the caller's Entra ID identity. */
export interface UserDelegationKey {
  signedOid: string;
  signedTid: string;
  signedStart: string;
  signedExpiry: string;
  signedService: string;
  signedVersion: string;
  /** Base64 HMAC key. Never log it. */
  value: string;
}

export interface BlobSasOptions {
  accountName: string;
  container: string;
  blob: string;
  /** For example `r` (read) or `cw` (create and write). */
  permissions: string;
  expiresOn: Date;
  key: UserDelegationKey;
}

/** Second precision UTC time, the only format a SAS accepts. */
export function sasTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * The string to sign of a user delegation SAS for one blob, versions
 * 2020-12-06 and later (up to 2025-07-05, which added fields).
 * https://learn.microsoft.com/rest/api/storageservices/create-user-delegation-sas#version-2020-12-06-and-later
 *
 * Empty lines are optional fields this app never sets: start time, delegated
 * user and correlation ids, IP range, snapshot, encryption scope and the five
 * response header overrides.
 */
export function userDelegationStringToSign(options: BlobSasOptions): string {
  const { key } = options;
  return [
    options.permissions,
    '', // signedStart: valid immediately
    sasTime(options.expiresOn),
    `/blob/${options.accountName}/${options.container}/${options.blob}`,
    key.signedOid,
    key.signedTid,
    key.signedStart,
    key.signedExpiry,
    key.signedService,
    key.signedVersion,
    '', // signedAuthorizedUserObjectId
    '', // signedUnauthorizedUserObjectId
    '', // signedCorrelationId
    '', // signedIP
    'https',
    STORAGE_API_VERSION,
    'b', // signedResource: a blob
    '', // signedSnapshotTime
    '', // signedEncryptionScope
    '', // rscc
    '', // rscd
    '', // rsce
    '', // rscl
    '', // rsct
  ].join('\n');
}

/** Query string (without `?`) of a user delegation SAS for one blob. */
export function createBlobSas(options: BlobSasOptions): string {
  const signature = createHmac('sha256', Buffer.from(options.key.value, 'base64'))
    .update(userDelegationStringToSign(options), 'utf8')
    .digest('base64');
  const { key } = options;
  return new URLSearchParams({
    sv: STORAGE_API_VERSION,
    spr: 'https',
    se: sasTime(options.expiresOn),
    skoid: key.signedOid,
    sktid: key.signedTid,
    skt: key.signedStart,
    ske: key.signedExpiry,
    sks: key.signedService,
    skv: key.signedVersion,
    sr: 'b',
    sp: options.permissions,
    sig: signature,
  }).toString();
}

const KEY_FIELDS = {
  signedOid: 'SignedOid',
  signedTid: 'SignedTid',
  signedStart: 'SignedStart',
  signedExpiry: 'SignedExpiry',
  signedService: 'SignedService',
  signedVersion: 'SignedVersion',
  value: 'Value',
} as const satisfies Record<keyof UserDelegationKey, string>;

/**
 * Reads the XML body of Get User Delegation Key. The body is flat and every
 * value is a GUID, a time, a version or base64, so a pattern per element is
 * enough and avoids an XML parser dependency.
 */
export function parseUserDelegationKey(xml: string): UserDelegationKey | undefined {
  const key: Partial<UserDelegationKey> = {};
  for (const [field, element] of Object.entries(KEY_FIELDS) as [
    keyof UserDelegationKey,
    string,
  ][]) {
    const match = new RegExp(`<${element}>([^<]+)</${element}>`).exec(xml);
    if (!match?.[1]) return undefined;
    key[field] = match[1];
  }
  return key as UserDelegationKey;
}
