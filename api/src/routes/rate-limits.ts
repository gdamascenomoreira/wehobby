/** Per user (or per IP when signed out) limit for routes that write data. */
export const WRITE_RATE_LIMIT = { max: 20, timeWindow: '1 minute' } as const;

/** Hobby type suggestions are reviewed by hand, so each user gets only a few. */
export const SUGGESTION_RATE_LIMIT = { max: 5, timeWindow: '1 hour' } as const;

/** Username checks run as the user types, so they get a higher limit. */
export const LOOKUP_RATE_LIMIT = { max: 60, timeWindow: '1 minute' } as const;

/** New photo uploads: enough for several posts an hour, not for filling storage. */
export const UPLOAD_RATE_LIMIT = { max: 60, timeWindow: '1 hour' } as const;
