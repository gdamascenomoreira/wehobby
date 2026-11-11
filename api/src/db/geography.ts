import { sql, type SQL } from 'drizzle-orm';
import { customType } from 'drizzle-orm/pg-core';

/**
 * The only place with raw PostGIS SQL. Drizzle has no geography type, so
 * points are written with `pointSql()` and read back only inside SQL (for
 * example by `pointLat`/`pointLng` in tests); the API never selects them into
 * a response.
 */
export const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType: () => 'geography(Point, 4326)',
});

/** A WGS 84 point. PostGIS takes longitude first. */
export function pointSql(lat: number, lng: number): SQL {
  return sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
}

/** Latitude of a geography column, for tests and future distance queries. */
export function pointLat(column: SQL | SQL.Aliased | object): SQL<number> {
  return sql<number>`ST_Y(${column}::geometry)`.mapWith(Number);
}

/** Longitude of a geography column. */
export function pointLng(column: SQL | SQL.Aliased | object): SQL<number> {
  return sql<number>`ST_X(${column}::geometry)`.mapWith(Number);
}
