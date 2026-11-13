import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createBlobSas,
  parseUserDelegationKey,
  sasTime,
  STORAGE_API_VERSION,
  userDelegationStringToSign,
  type UserDelegationKey,
} from './sas.js';

const KEY: UserDelegationKey = {
  signedOid: '11111111-1111-4111-8111-111111111111',
  signedTid: '22222222-2222-4222-8222-222222222222',
  signedStart: '2026-11-13T10:00:00Z',
  signedExpiry: '2026-11-14T10:00:00Z',
  signedService: 'b',
  signedVersion: '2022-11-02',
  value: Buffer.from('placeholder-test-key').toString('base64'),
};

const OPTIONS = {
  accountName: 'stwehobbytest',
  container: 'photos',
  blob: 'incoming/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  permissions: 'cw',
  expiresOn: new Date('2026-11-13T10:05:00.123Z'),
  key: KEY,
};

describe('sasTime', () => {
  it('drops the milliseconds', () => {
    expect(sasTime(new Date('2026-11-13T10:05:00.999Z'))).toBe('2026-11-13T10:05:00Z');
  });
});

describe('userDelegationStringToSign', () => {
  it('has the 24 fields of the 2020-12-06 format, in order', () => {
    const lines = userDelegationStringToSign(OPTIONS).split('\n');
    expect(lines).toEqual([
      'cw', // signedPermissions
      '', // signedStart
      '2026-11-13T10:05:00Z', // signedExpiry
      '/blob/stwehobbytest/photos/incoming/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      KEY.signedOid,
      KEY.signedTid,
      KEY.signedStart,
      KEY.signedExpiry,
      KEY.signedService,
      KEY.signedVersion,
      '', // signedAuthorizedUserObjectId
      '', // signedUnauthorizedUserObjectId
      '', // signedCorrelationId
      '', // signedIP
      'https', // signedProtocol
      STORAGE_API_VERSION,
      'b', // signedResource
      '', // signedSnapshotTime
      '', // signedEncryptionScope
      '', // rscc
      '', // rscd
      '', // rsce
      '', // rscl
      '', // rsct
    ]);
  });
});

describe('createBlobSas', () => {
  const params = new URLSearchParams(createBlobSas(OPTIONS));

  it('carries every signed field the service needs to rebuild the string to sign', () => {
    expect(Object.fromEntries([...params].filter(([name]) => name !== 'sig'))).toEqual({
      sv: STORAGE_API_VERSION,
      spr: 'https',
      se: '2026-11-13T10:05:00Z',
      skoid: KEY.signedOid,
      sktid: KEY.signedTid,
      skt: KEY.signedStart,
      ske: KEY.signedExpiry,
      sks: 'b',
      skv: KEY.signedVersion,
      sr: 'b',
      sp: 'cw',
    });
  });

  it('signs with HMAC-SHA256 of the decoded key', () => {
    const expected = createHmac('sha256', Buffer.from(KEY.value, 'base64'))
      .update(userDelegationStringToSign(OPTIONS))
      .digest('base64');
    expect(params.get('sig')).toBe(expected);
  });

  it('gives a different signature for another blob or permission', () => {
    const other = new URLSearchParams(createBlobSas({ ...OPTIONS, permissions: 'r' }));
    expect(other.get('sig')).not.toBe(params.get('sig'));
    const otherBlob = new URLSearchParams(
      createBlobSas({ ...OPTIONS, blob: 'incoming/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
    );
    expect(otherBlob.get('sig')).not.toBe(params.get('sig'));
  });

  it('never contains the key itself', () => {
    expect(createBlobSas(OPTIONS)).not.toContain(encodeURIComponent(KEY.value));
  });
});

describe('parseUserDelegationKey', () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?><UserDelegationKey><SignedOid>${KEY.signedOid}</SignedOid><SignedTid>${KEY.signedTid}</SignedTid><SignedStart>${KEY.signedStart}</SignedStart><SignedExpiry>${KEY.signedExpiry}</SignedExpiry><SignedService>b</SignedService><SignedVersion>${KEY.signedVersion}</SignedVersion><Value>${KEY.value}</Value></UserDelegationKey>`;

  it('reads every field', () => {
    expect(parseUserDelegationKey(xml)).toEqual(KEY);
  });

  it('returns undefined when a field is missing', () => {
    expect(parseUserDelegationKey(xml.replace(/<Value>.*<\/Value>/, ''))).toBeUndefined();
    expect(parseUserDelegationKey('not xml')).toBeUndefined();
  });
});
