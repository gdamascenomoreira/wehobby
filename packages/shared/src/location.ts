import { z } from 'zod';

export const PLACE_QUERY_MIN_LENGTH = 3;
export const PLACE_QUERY_MAX_LENGTH = 80;
/** Most places one search returns. */
export const MAX_PLACE_RESULTS = 5;
/** Decimal places kept in stored coordinates: 0.01 degrees is about 1 km. */
export const COORDINATE_DECIMALS = 2;

/**
 * Rounds a latitude or longitude to about 1 km. Both the browser (before
 * sending) and the API (before anything else) call it, so an exact position
 * is never stored.
 */
export function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS;
  const rounded = Math.round(value * factor) / factor;
  // Math.round(-0.004 * 100) is -0; store and compare plain 0.
  return rounded === 0 ? 0 : rounded;
}

/** Query string of `GET /api/places/search`. */
export const PlaceSearchQuerySchema = z.object({
  q: z.string().trim().min(PLACE_QUERY_MIN_LENGTH).max(PLACE_QUERY_MAX_LENGTH),
});
export type PlaceSearchQuery = z.infer<typeof PlaceSearchQuerySchema>;

/** ISO 3166-1 alpha-2, for example `PT`. */
export const CountryCodeSchema = z.string().regex(/^[A-Z]{2}$/, { error: 'Invalid country code' });

/** One search result: a city or municipality, never coordinates. */
export const PlaceSchema = z.object({
  id: z.uuid(),
  /** For example "Vila Franca de Xira, Lisboa", in the user's language. */
  label: z.string(),
  countryCode: CountryCodeSchema,
});
export type Place = z.infer<typeof PlaceSchema>;

/** Response body of `GET /api/places/search`. */
export const PlaceSearchResponseSchema = z.object({
  places: z.array(PlaceSchema).max(MAX_PLACE_RESULTS),
});
export type PlaceSearchResponse = z.infer<typeof PlaceSearchResponseSchema>;

export const LatitudeSchema = z.number().min(-90).max(90);
export const LongitudeSchema = z.number().min(-180).max(180);

/**
 * Body of `PUT /api/me/location`: a place picked from the search, or the
 * browser position (already rounded). Strict objects, so a body with both
 * shapes, or neither, is rejected.
 */
export const UpdateMyLocationSchema = z.union([
  z.strictObject({ placeId: z.uuid() }),
  z.strictObject({ lat: LatitudeSchema, lng: LongitudeSchema }),
]);
export type UpdateMyLocation = z.infer<typeof UpdateMyLocationSchema>;

/** The user's area as the API returns it: a label only, never a point. */
export const MyLocationSchema = z.object({
  label: z.string(),
  countryCode: CountryCodeSchema,
});
export type MyLocation = z.infer<typeof MyLocationSchema>;
