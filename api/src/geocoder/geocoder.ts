import type { Language } from '@wehobby/shared';

/** A city or municipality found by a geocoder, with its centre point. */
export interface GeocodedPlace {
  /** For example "Vila Franca de Xira, Lisboa". */
  label: string;
  /** ISO 3166-1 alpha-2, uppercase. */
  countryCode: string;
  lat: number;
  lng: number;
}

/**
 * Turns place names into points and points into place names, at city or
 * municipality level only. Implementations: Azure Maps in production, a fixed
 * list of cities in tests and local development.
 */
export interface Geocoder {
  search(query: string, language: Language): Promise<GeocodedPlace[]>;
  reverse(lat: number, lng: number, language: Language): Promise<GeocodedPlace | undefined>;
}

export type GeocoderErrorReason = 'timeout' | 'http' | 'parse' | 'credential' | 'network';

/**
 * A geocoder call failed. The message never contains the query or the
 * coordinates, so it is safe to log.
 */
export class GeocoderError extends Error {
  constructor(
    readonly reason: GeocoderErrorReason,
    message: string,
    options?: { cause?: unknown; status?: number },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'GeocoderError';
    this.status = options?.status;
  }

  readonly status: number | undefined;
}
