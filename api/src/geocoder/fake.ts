import type { Language } from '@wehobby/shared';
import type { GeocodedPlace, Geocoder } from './geocoder.js';

interface FakeCity {
  labels: Record<Language, string>;
  countryCode: string;
  lat: number;
  lng: number;
}

/** Public city centres, rounded. Used in tests, CI and local development. */
export const FAKE_CITIES: readonly FakeCity[] = [
  { labels: { pt: 'Lisboa', en: 'Lisbon' }, countryCode: 'PT', lat: 38.72, lng: -9.14 },
  { labels: { pt: 'Porto', en: 'Porto' }, countryCode: 'PT', lat: 41.15, lng: -8.61 },
  {
    labels: { pt: 'Vila Franca de Xira, Lisboa', en: 'Vila Franca de Xira, Lisbon' },
    countryCode: 'PT',
    lat: 38.96,
    lng: -8.99,
  },
  { labels: { pt: 'Coimbra', en: 'Coimbra' }, countryCode: 'PT', lat: 40.21, lng: -8.43 },
  { labels: { pt: 'Braga', en: 'Braga' }, countryCode: 'PT', lat: 41.55, lng: -8.42 },
  { labels: { pt: 'Faro', en: 'Faro' }, countryCode: 'PT', lat: 37.02, lng: -7.93 },
  { labels: { pt: 'Setúbal', en: 'Setúbal' }, countryCode: 'PT', lat: 38.52, lng: -8.89 },
  { labels: { pt: 'Aveiro', en: 'Aveiro' }, countryCode: 'PT', lat: 40.64, lng: -8.65 },
  { labels: { pt: 'Évora', en: 'Évora' }, countryCode: 'PT', lat: 38.57, lng: -7.91 },
  {
    labels: { pt: 'Funchal, Madeira', en: 'Funchal, Madeira' },
    countryCode: 'PT',
    lat: 32.65,
    lng: -16.91,
  },
  { labels: { pt: 'Madrid', en: 'Madrid' }, countryCode: 'ES', lat: 40.42, lng: -3.7 },
  { labels: { pt: 'Paris', en: 'Paris' }, countryCode: 'FR', lat: 48.86, lng: 2.35 },
  { labels: { pt: 'Londres', en: 'London' }, countryCode: 'GB', lat: 51.51, lng: -0.13 },
];

/** Reverse lookups farther than this from every city find nothing (for example at sea). */
const MAX_REVERSE_DISTANCE_DEGREES = 1;

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

function toPlace(city: FakeCity, language: Language): GeocodedPlace {
  return {
    label: city.labels[language],
    countryCode: city.countryCode,
    lat: city.lat,
    lng: city.lng,
  };
}

/** A geocoder over FAKE_CITIES: matches any label containing the query, ignoring accents. */
export function createFakeGeocoder(): Geocoder {
  return {
    search(query, language) {
      const needle = normalize(query);
      const matches = FAKE_CITIES.filter((city) =>
        Object.values(city.labels).some((label) => normalize(label).includes(needle)),
      );
      return Promise.resolve(matches.map((city) => toPlace(city, language)));
    },

    reverse(lat, lng, language) {
      let nearest: FakeCity | undefined;
      let nearestDistance = Infinity;
      for (const city of FAKE_CITIES) {
        const distance = Math.hypot(city.lat - lat, city.lng - lng);
        if (distance < nearestDistance) {
          nearest = city;
          nearestDistance = distance;
        }
      }
      return Promise.resolve(
        nearest && nearestDistance <= MAX_REVERSE_DISTANCE_DEGREES
          ? toPlace(nearest, language)
          : undefined,
      );
    },
  };
}
