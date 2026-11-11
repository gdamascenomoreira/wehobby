import type { Language, MyLocation, Place } from '@wehobby/shared';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { pointSql } from '../db/geography.js';
import { places, placeSearches, users } from '../db/schema.js';
import type { GeocodedPlace } from '../geocoder/index.js';

/** Cached searches older than this are sent to the geocoder again. */
export const PLACE_SEARCH_TTL_DAYS = 30;

/** Cache key for a search: case, accents kept, spacing ignored. */
export function normalizeQuery(query: string): string {
  return query.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

const placeColumns = { id: places.id, label: places.label, countryCode: places.countryCode };

/**
 * Places (the geocoder cache) and the user's own location. User methods are
 * keyed by the Entra object id from the verified token, so a user can only
 * change their own row. Nothing here ever returns a coordinate.
 */
export function createLocationRepository(db: Database) {
  /** Inserts the place, or returns the existing row with the same label, country and language. */
  async function upsertPlace(place: GeocodedPlace, language: Language): Promise<Place> {
    const [row] = await db
      .insert(places)
      .values({
        label: place.label,
        countryCode: place.countryCode,
        centre: pointSql(place.lat, place.lng),
        language,
      })
      .onConflictDoUpdate({
        target: [places.label, places.countryCode, places.language],
        // A no-op update, so RETURNING gives the existing id. The centre is kept.
        set: { label: sql`excluded.label` },
      })
      .returning(placeColumns);
    if (!row) throw new Error('Upsert returned no row');
    return row;
  }

  return {
    upsertPlace,

    /** The cached result of a search, or undefined on a miss or an expired entry. */
    async findCachedSearch(query: string, language: Language): Promise<Place[] | undefined> {
      const [entry] = await db
        .select({ placeIds: placeSearches.placeIds })
        .from(placeSearches)
        .where(
          and(
            eq(placeSearches.query, normalizeQuery(query)),
            eq(placeSearches.language, language),
            gt(
              placeSearches.createdAt,
              sql`now() - make_interval(days => ${PLACE_SEARCH_TTL_DAYS})`,
            ),
          ),
        )
        .limit(1);
      if (!entry) return undefined;
      if (entry.placeIds.length === 0) return [];

      const rows = await db
        .select(placeColumns)
        .from(places)
        .where(inArray(places.id, entry.placeIds));
      const byId = new Map(rows.map((row) => [row.id, row]));
      return entry.placeIds.flatMap((id) => byId.get(id) ?? []);
    },

    /** Saves every result as a place and remembers the search. Returns the places in order. */
    async saveSearch(
      query: string,
      language: Language,
      results: readonly GeocodedPlace[],
    ): Promise<Place[]> {
      const saved: Place[] = [];
      for (const result of results) {
        const place = await upsertPlace(result, language);
        if (!saved.some((existing) => existing.id === place.id)) saved.push(place);
      }
      const placeIds = saved.map((place) => place.id);
      await db
        .insert(placeSearches)
        .values({ query: normalizeQuery(query), language, placeIds })
        .onConflictDoUpdate({
          target: [placeSearches.query, placeSearches.language],
          set: { placeIds, createdAt: sql`now()` },
        });
      return saved;
    },

    /**
     * Copies a cached place (centre, label, country) to the user, or says why
     * it could not.
     */
    async setFromPlace(
      oid: string,
      placeId: string,
    ): Promise<MyLocation | 'no_profile' | 'place_not_found'> {
      const [place] = await db
        .select({ ...placeColumns, centre: places.centre })
        .from(places)
        .where(eq(places.id, placeId))
        .limit(1);
      if (!place) return 'place_not_found';

      const [row] = await db
        .update(users)
        .set({
          location: place.centre,
          locationLabel: place.label,
          locationCountryCode: place.countryCode,
          updatedAt: sql`now()`,
        })
        .where(eq(users.entraOid, oid))
        .returning({ label: users.locationLabel, countryCode: users.locationCountryCode });
      if (!row?.label || !row.countryCode) return 'no_profile';
      return { label: row.label, countryCode: row.countryCode };
    },

    /** Stores an already rounded point with its label. */
    async setPoint(
      oid: string,
      point: { lat: number; lng: number },
      place: Pick<Place, 'label' | 'countryCode'>,
    ): Promise<MyLocation | 'no_profile'> {
      const [row] = await db
        .update(users)
        .set({
          location: pointSql(point.lat, point.lng),
          locationLabel: place.label,
          locationCountryCode: place.countryCode,
          updatedAt: sql`now()`,
        })
        .where(eq(users.entraOid, oid))
        .returning({ id: users.id });
      return row ? { label: place.label, countryCode: place.countryCode } : 'no_profile';
    },

    /** Clears all three location columns. False when the user has no profile. */
    async clear(oid: string): Promise<boolean> {
      const [row] = await db
        .update(users)
        .set({
          location: null,
          locationLabel: null,
          locationCountryCode: null,
          updatedAt: sql`now()`,
        })
        .where(eq(users.entraOid, oid))
        .returning({ id: users.id });
      return row !== undefined;
    },
  };
}

export type LocationRepository = ReturnType<typeof createLocationRepository>;
