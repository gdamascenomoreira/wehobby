import { describe, expect, it } from 'vitest';
import { CreateUploadSchema, MAX_UPLOAD_BYTES } from './uploads.js';

describe('CreateUploadSchema', () => {
  it('accepts JPEG, PNG and WebP up to the size limit', () => {
    for (const contentType of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(CreateUploadSchema.safeParse({ contentType, size: MAX_UPLOAD_BYTES }).success).toBe(
        true,
      );
    }
  });

  it('rejects other types, including HEIC', () => {
    for (const contentType of ['image/heic', 'image/gif', 'application/pdf', 'image/svg+xml']) {
      expect(CreateUploadSchema.safeParse({ contentType, size: 1000 }).success).toBe(false);
    }
  });

  it('rejects empty and too large files', () => {
    const contentType = 'image/jpeg';
    expect(CreateUploadSchema.safeParse({ contentType, size: 0 }).success).toBe(false);
    expect(CreateUploadSchema.safeParse({ contentType, size: MAX_UPLOAD_BYTES + 1 }).success).toBe(
      false,
    );
    expect(CreateUploadSchema.safeParse({ contentType, size: 1.5 }).success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(
      CreateUploadSchema.safeParse({ contentType: 'image/jpeg', size: 10, path: 'x' }).success,
    ).toBe(false);
  });
});
