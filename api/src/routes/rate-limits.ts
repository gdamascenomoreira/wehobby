/** Per user (or per IP when signed out) limit for routes that write data. */
export const WRITE_RATE_LIMIT = { max: 20, timeWindow: '1 minute' } as const;

/** Username checks run as the user types, so they get a higher limit. */
export const LOOKUP_RATE_LIMIT = { max: 60, timeWindow: '1 minute' } as const;
