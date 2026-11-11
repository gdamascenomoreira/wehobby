import type { MyLocation, Place, Profile } from '@wehobby/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from './i18n';
import {
  fakeAuthClient,
  giovanna,
  giovannaHobbies,
  hobbyCatalog,
  json,
  renderApp,
  stubApi,
  type ApiRoutes,
} from './test/renderApp';

const LISBOA: Place = {
  id: '3b9d6a1e-2c4f-4e8a-9b7c-5d6e7f8a9b0c',
  label: 'Lisboa',
  countryCode: 'PT',
};
const VILA_FRANCA: MyLocation = { label: 'Vila Franca de Xira, Lisboa', countryCode: 'PT' };

function routes(profile: Profile = giovanna, extra: ApiRoutes = {}): ApiRoutes {
  return {
    'GET /api/health': () => json({ status: 'ok', version: 'test' }),
    'GET /api/me': () => json(profile),
    'GET /api/hobbies': () => json(hobbyCatalog),
    'GET /api/me/hobbies': () => json(giovannaHobbies),
    'GET /api/places/search': (_body, url) =>
      json({ places: url.searchParams.get('q')?.toLowerCase().startsWith('lis') ? [LISBOA] : [] }),
    ...extra,
  };
}

type GeolocationOutcome = { lat: number; lng: number } | 'denied' | 'unavailable';

/** Replaces navigator.geolocation with one that answers `outcome`. */
function stubGeolocation(outcome: GeolocationOutcome) {
  const getCurrentPosition = vi.fn<Geolocation['getCurrentPosition']>((success, failure) => {
    if (typeof outcome === 'object') {
      const position = { coords: { latitude: outcome.lat, longitude: outcome.lng } };
      success(position as unknown as GeolocationPosition);
    } else {
      failure?.({
        code: outcome === 'denied' ? 1 : 2,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: outcome,
      });
    }
  });
  vi.stubGlobal('navigator', {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages,
    geolocation: { getCurrentPosition },
  });
  return getCurrentPosition;
}

describe('location', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('onboarding step', () => {
    it('comes after the hobby step and can be skipped', async () => {
      stubApi(
        routes(giovanna, {
          'GET /api/me/hobbies': () => json({ hobbies: [] }),
          'PUT /api/me/hobbies': () => json(giovannaHobbies),
        }),
      );
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(true) });

      await user.click(await screen.findByRole('checkbox', { name: 'Crochet' }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(
        await screen.findByRole('heading', { name: 'Where do you do your hobby?' }),
      ).toBeInTheDocument();
      expect(screen.getByText(/never a pin on a map/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Skip for now' }));
      expect(await screen.findByRole('heading', { name: 'Hello, Giovanna!' })).toBeInTheDocument();
    });

    it('sends the rounded browser position and goes home', async () => {
      const sent: unknown[] = [];
      stubApi(
        routes(giovanna, {
          'PUT /api/me/location': (body) => {
            sent.push(body);
            return json(VILA_FRANCA);
          },
        }),
      );
      const getCurrentPosition = stubGeolocation({ lat: 38.955471, lng: -8.987234 });
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(true), path: '/onboarding/location' });

      await user.click(await screen.findByRole('button', { name: 'Use my current location' }));

      expect(await screen.findByText(/Vila Franca de Xira, Lisboa/)).toBeInTheDocument();
      expect(sent).toEqual([{ lat: 38.96, lng: -8.99 }]);
      expect(getCurrentPosition.mock.calls[0]?.[2]).toMatchObject({ enableHighAccuracy: false });
    });

    it('falls back to the city search when permission is denied', async () => {
      const fetchMock = stubApi(routes());
      stubGeolocation('denied');
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(true), path: '/onboarding/location' });

      await user.click(await screen.findByRole('button', { name: 'Use my current location' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/search for your town or city/);
      expect(screen.getByRole('combobox', { name: 'Search for your town or city' })).toHaveFocus();
      expect(fetchMock).not.toHaveBeenCalledWith(
        '/api/me/location',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('explains when the position is unavailable', async () => {
      stubApi(routes());
      stubGeolocation('unavailable');
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(true), path: '/onboarding/location' });

      await user.click(await screen.findByRole('button', { name: 'Use my current location' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't get your location/);
    });
  });

  describe('city search', () => {
    it('waits for 3 characters, then picks a city with the keyboard', async () => {
      const sent: unknown[] = [];
      const fetchMock = stubApi(
        routes(giovanna, {
          'PUT /api/me/location': (body) => {
            sent.push(body);
            return json({ label: LISBOA.label, countryCode: 'PT' });
          },
        }),
      );
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(true), path: '/onboarding/location' });

      const input = await screen.findByRole('combobox', { name: 'Search for your town or city' });
      await user.type(input, 'Li');
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(
        fetchMock.mock.calls.some(
          ([url]) => typeof url === 'string' && url.startsWith('/api/places'),
        ),
      ).toBe(false);

      await user.type(input, 's');
      expect(await screen.findByRole('option', { name: 'Lisboa' })).toBeInTheDocument();
      expect(input).toHaveAttribute('aria-expanded', 'true');

      await user.keyboard('{ArrowDown}');
      const [option] = within(screen.getByRole('listbox')).getAllByRole('option');
      expect(input).toHaveAttribute('aria-activedescendant', option?.id);
      await user.keyboard('{Enter}');

      expect(await screen.findByRole('heading', { name: 'Hello, Giovanna!' })).toBeInTheDocument();
      expect(sent).toEqual([{ placeId: LISBOA.id }]);
    });

    it('says when nothing matches', async () => {
      stubApi(routes());
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(true), path: '/onboarding/location' });

      await user.type(
        await screen.findByRole('combobox', { name: 'Search for your town or city' }),
        'Xyzzy',
      );
      expect(await screen.findByText(/No places found/)).toBeInTheDocument();
    });
  });

  describe('home card', () => {
    it('invites users without a location, and stays dismissed', async () => {
      stubApi(routes());
      const user = userEvent.setup();
      const { unmount } = renderApp({ auth: fakeAuthClient(true) });

      const card = await screen.findByRole('complementary', {
        name: 'Add your area to see people near you',
      });
      expect(within(card).getByRole('link', { name: 'Add my area' })).toHaveAttribute(
        'href',
        '/onboarding/location',
      );
      await user.click(within(card).getByRole('button', { name: 'Not now' }));
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();

      unmount();
      renderApp({ auth: fakeAuthClient(true) });
      await screen.findByRole('heading', { name: 'Hello, Giovanna!' });
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    });

    it('is not shown when the user has a location', async () => {
      stubApi(routes({ ...giovanna, location: VILA_FRANCA }));
      renderApp({ auth: fakeAuthClient(true) });
      await screen.findByRole('heading', { name: 'Hello, Giovanna!' });
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    });
  });

  describe('settings', () => {
    it('changes the area by picking a city', async () => {
      stubApi(
        routes(
          { ...giovanna, location: VILA_FRANCA },
          {
            'PUT /api/me/location': () => json({ label: LISBOA.label, countryCode: 'PT' }),
          },
        ),
      );
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(true), path: '/settings' });

      const area = await screen.findByRole('region', { name: 'Your area' });
      expect(within(area).getByText(VILA_FRANCA.label)).toBeInTheDocument();

      await user.click(within(area).getByRole('button', { name: 'Change' }));
      await user.type(within(area).getByRole('combobox'), 'Lisb');
      await user.click(await within(area).findByRole('option', { name: 'Lisboa' }));

      expect(await within(area).findByText('Area saved.')).toBeInTheDocument();
      expect(within(area).getByText('Lisboa')).toBeInTheDocument();
    });

    it('removes the location after confirming in the page', async () => {
      const removed = vi.fn(() => new Response(null, { status: 204 }));
      stubApi(
        routes({ ...giovanna, location: VILA_FRANCA }, { 'DELETE /api/me/location': removed }),
      );
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(true), path: '/settings' });

      const area = await screen.findByRole('region', { name: 'Your area' });
      await user.click(within(area).getByRole('button', { name: 'Remove my location' }));
      expect(removed).not.toHaveBeenCalled();

      // Cancel keeps it.
      await user.click(within(area).getByRole('button', { name: 'Cancel' }));
      await user.click(within(area).getByRole('button', { name: 'Remove my location' }));
      await user.click(within(area).getByRole('button', { name: 'Yes, remove it' }));

      expect(await within(area).findByText('Your location was removed.')).toBeInTheDocument();
      expect(within(area).getByText('Not set')).toBeInTheDocument();
      expect(removed).toHaveBeenCalledTimes(1);
    });
  });

  describe('languages', () => {
    it('renders the step in Portuguese', async () => {
      stubApi(routes({ ...giovanna, language: 'pt' }));
      renderApp({ auth: fakeAuthClient(true), path: '/onboarding/location' });

      expect(
        await screen.findByRole('heading', { name: 'Onde praticas o teu hobby?' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Usar a minha localização atual' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('combobox', { name: 'Procura a tua localidade' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Saltar por agora' })).toBeInTheDocument();
    });

    it('renders Settings in Portuguese', async () => {
      stubApi(routes({ ...giovanna, language: 'pt', location: VILA_FRANCA }));
      renderApp({ auth: fakeAuthClient(true), path: '/settings' });

      const area = await screen.findByRole('region', { name: 'A tua zona' });
      expect(
        within(area).getByRole('button', { name: 'Remover a minha localização' }),
      ).toBeInTheDocument();
    });
  });
});
