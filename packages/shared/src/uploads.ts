import { z } from 'zod';

/**
 * Photo types the worker can read. HEIC is left out: the prebuilt image
 * library cannot decode it, and iPhone Safari converts library photos to JPEG
 * when a page asks for images.
 */
export const UPLOAD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const UploadContentTypeSchema = z.enum(UPLOAD_CONTENT_TYPES);
export type UploadContentType = z.infer<typeof UploadContentTypeSchema>;

/** Largest original photo accepted, in bytes (15 MB). */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** Body of `POST /api/uploads`: what the browser is about to send. */
export const CreateUploadSchema = z.strictObject({
  contentType: UploadContentTypeSchema,
  size: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
});
export type CreateUpload = z.infer<typeof CreateUploadSchema>;

/**
 * Response of `POST /api/uploads`. The browser sends the file with
 * `PUT uploadUrl`, using exactly these headers, before `expiresAt`.
 */
export const CreateUploadResponseSchema = z.object({
  id: z.uuid(),
  /** A short lived, write only link for this one photo. Absolute or same origin. */
  uploadUrl: z.string().min(1),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.iso.datetime(),
});
export type CreateUploadResponse = z.infer<typeof CreateUploadResponseSchema>;

export const UPLOAD_STATUSES = ['pending', 'processing', 'ready', 'failed'] as const;
export const UploadStatusSchema = z.enum(UPLOAD_STATUSES);
export type UploadStatus = z.infer<typeof UploadStatusSchema>;

/** A processed photo: short lived read links, no metadata. */
export const PhotoSchema = z.object({
  fullUrl: z.string().min(1),
  thumbUrl: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type Photo = z.infer<typeof PhotoSchema>;

/** Response of `GET` and `POST .../complete` on `/api/uploads/:id`. `photo` is set once ready. */
export const UploadSchema = z.object({
  id: z.uuid(),
  status: UploadStatusSchema,
  photo: PhotoSchema.nullable(),
});
export type Upload = z.infer<typeof UploadSchema>;

export const UploadParamsSchema = z.object({ id: z.uuid() });
