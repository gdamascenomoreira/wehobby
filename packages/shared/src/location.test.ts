import { describe, expect, it } from 'vitest';
import { PlaceSearchQuerySchema, roundCoordinate, UpdateMyLocationSchema } from './location.js';

const PLACE_ID = '7f1c2a9e-4b3d-4e5f-8a6b-1c2d3e4f5a6b';

describe('roundCoordinate', () => {
  it('keeps 2 decimal places', () => {
    expect(roundCoordinate(38.95547)).toBe(38.96);
    expect(roundCoordinate(-9.00123)).toBe(-9);
    expect(roundCoordinate(-8.9951)).toBe(-9);
  });

  it('never returns negative zero', () => {
    expect(Object.is(roundCoordinate(-0.004), 0)).toBe(true);
  });

  it('leaves already rounded values alone', () => {
    expect(roundCoordinate(roundCoordinate(41.14961))).toBe(41.15);
  });
});

describe('PlaceSearchQuerySchema', () => {
  it('trims the query', () => {
    expect(PlaceSearchQuerySchema.parse({ q: '  Lisboa ' })).toEqual({ q: 'Lisboa' });
  });

  it('needs 3 to 80 characters after trimming', () => {
    expect(PlaceSearchQuerySchema.safeParse({ q: ' Li ' }).success).toBe(false);
    expect(PlaceSearchQuerySchema.safeParse({ q: 'a'.repeat(81) }).success).toBe(false);
    expect(PlaceSearchQuerySchema.safeParse({ q: 'a'.repeat(80) }).success).toBe(true);
    expect(PlaceSearchQuerySchema.safeParse({}).success).toBe(false);
  });
});

describe('UpdateMyLocationSchema', () => {
  it('accepts a place id', () => {
    expect(UpdateMyLocationSchema.parse({ placeId: PLACE_ID })).toEqual({ placeId: PLACE_ID });
  });

  it('accepts coordinates', () => {
    expect(UpdateMyLocationSchema.parse({ lat: 38.72, lng: -9.14 })).toEqual({
      lat: 38.72,
      lng: -9.14,
    });
  });

  it('rejects an empty body', () => {
    expect(UpdateMyLocationSchema.safeParse({}).success).toBe(false);
  });

  it('rejects both shapes at once', () => {
    expect(
      UpdateMyLocationSchema.safeParse({ placeId: PLACE_ID, lat: 38.72, lng: -9.14 }).success,
    ).toBe(false);
  });

  it('rejects half a coordinate pair', () => {
    expect(UpdateMyLocationSchema.safeParse({ lat: 38.72 }).success).toBe(false);
  });

  it('rejects out of range and non numeric coordinates', () => {
    for (const body of [
      { lat: 90.01, lng: 0 },
      { lat: -90.01, lng: 0 },
      { lat: 0, lng: 180.01 },
      { lat: 0, lng: -180.01 },
      { lat: '38.72', lng: -9.14 },
      { lat: Number.NaN, lng: 0 },
    ]) {
      expect(UpdateMyLocationSchema.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
  });

  it('rejects a place id that is not a uuid', () => {
    expect(UpdateMyLocationSchema.safeParse({ placeId: 'lisboa' }).success).toBe(false);
  });
});
