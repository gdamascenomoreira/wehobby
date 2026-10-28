import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import i18n, { LANGUAGE_STORAGE_KEY } from './i18n';
import {
  fakeAuthClient,
  giovanna,
  json,
  renderApp,
  stubApi,
  TEST_TOKEN,
  type ApiRoutes,
} from './test/renderApp';

const health: ApiRoutes = {
  'GET /api/health': () => json({ status: 'ok', version: 'test' }),
};

describe('App', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('signed out', () => {
    it('offers sign in and shows the API status from /api/health', async () => {
      const fetchMock = stubApi(health);
      const auth = fakeAuthClient(false);
      renderApp({ auth });

      expect(await screen.findByText('API status: ok')).toBeInTheDocument();
      // Same origin request, so it works behind Caddy and the dev server proxy.
      expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.anything());

      await userEvent.click(screen.getByRole('button', { name: 'Sign in or create an account' }));
      expect(auth.signIn).toHaveBeenCalled();
    });

    it('shows the API as unavailable when /api/health fails', async () => {
      stubApi({ 'GET /api/health': () => new Response(null, { status: 503 }) });
      renderApp({ auth: fakeAuthClient(false) });

      expect(await screen.findByText('API status: unavailable')).toBeInTheDocument();
    });

    it('does not open settings or onboarding', async () => {
      stubApi(health);
      renderApp({ auth: fakeAuthClient(false), path: '/settings' });

      expect(
        await screen.findByRole('button', { name: 'Sign in or create an account' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    });

    it('switches the language between English and Portuguese', async () => {
      stubApi(health);
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(false) });
      expect(await screen.findByText('API status: ok')).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText('Language'), 'pt');

      expect(screen.getByText('Partilha o dia a dia do teu hobby.')).toBeInTheDocument();
      expect(screen.getByText('Estado da API: ok')).toBeInTheDocument();
      expect(document.documentElement.lang).toBe('pt');
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pt');

      await user.selectOptions(screen.getByLabelText('Idioma'), 'en');
      expect(screen.getByText('Share the everyday side of your hobby.')).toBeInTheDocument();
    });
  });

  describe('onboarding', () => {
    it('sends a signed in user without a profile to onboarding', async () => {
      stubApi(health);
      renderApp({ auth: fakeAuthClient(true) });

      expect(
        await screen.findByRole('heading', { name: 'Create your profile' }),
      ).toBeInTheDocument();
    });

    it('explains what is missing before submitting', async () => {
      const fetchMock = stubApi(health);
      renderApp({ auth: fakeAuthClient(true) });

      await userEvent.click(await screen.findByRole('button', { name: 'Create profile' }));

      expect(screen.getByLabelText('Username')).toHaveAccessibleDescription(
        expect.stringContaining('Use 3 to 30 lowercase letters'),
      );
      expect(screen.getByText('Enter a name of up to 50 characters.')).toBeInTheDocument();
      expect(screen.getByText('You must be 16 or older to use WeHobby.')).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalledWith(
        '/api/me',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('creates the profile with the access token, then shows the home page', async () => {
      const created: unknown[] = [];
      const fetchMock = stubApi({
        ...health,
        'GET /api/usernames/giovanna_crochet': () =>
          json({ username: 'giovanna_crochet', available: true }),
        'POST /api/me': (body) => {
          created.push(body);
          return json(giovanna, 201);
        },
      });
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(true) });

      await user.type(await screen.findByLabelText('Username'), 'Giovanna_Crochet');
      await user.tab();
      expect(await screen.findByText('This username is available.')).toBeInTheDocument();
      await user.type(screen.getByLabelText('Display name'), 'Giovanna');
      await user.click(screen.getByLabelText('I am 16 or older'));
      await user.click(screen.getByRole('button', { name: 'Create profile' }));

      expect(await screen.findByRole('heading', { name: 'Hello, Giovanna!' })).toBeInTheDocument();
      expect(created).toEqual([
        {
          username: 'giovanna_crochet',
          displayName: 'Giovanna',
          language: 'en',
          ageConfirmed: true,
        },
      ]);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/me',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ authorization: `Bearer ${TEST_TOKEN}` }) as unknown,
        }),
      );
    });

    it('shows when the username is taken', async () => {
      stubApi({
        ...health,
        'GET /api/usernames/beatriz': () => json({ username: 'beatriz', available: false }),
        'POST /api/me': () => json({ error: 'username_taken', message: 'taken' }, 409),
      });
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(true) });

      await user.type(await screen.findByLabelText('Username'), 'beatriz');
      await user.tab();
      expect(await screen.findByText('This username is already taken.')).toBeInTheDocument();

      // The server has the final say, even if the check said it was free.
      await user.type(screen.getByLabelText('Display name'), 'Beatriz');
      await user.click(screen.getByLabelText('I am 16 or older'));
      await user.click(screen.getByRole('button', { name: 'Create profile' }));
      expect(await screen.findByText('This username is already taken.')).toBeInTheDocument();
    });
  });

  describe('signed in with a profile', () => {
    it('uses the language saved in the profile', async () => {
      stubApi({ ...health, 'GET /api/me': () => json({ ...giovanna, language: 'pt' }) });
      renderApp({ auth: fakeAuthClient(true) });

      expect(await screen.findByRole('heading', { name: 'Olá, Giovanna!' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Definições' })).toBeInTheDocument();
    });

    it('edits the profile in settings and signs out', async () => {
      const patches: unknown[] = [];
      stubApi({
        ...health,
        'GET /api/me': () => json(giovanna),
        'PATCH /api/me': (body) => {
          patches.push(body);
          return json({ ...giovanna, bio: 'Amigurumi every day' });
        },
      });
      const auth = fakeAuthClient(true);
      const user = userEvent.setup();
      renderApp({ auth });

      await user.click(await screen.findByRole('link', { name: 'Settings' }));
      expect(screen.getByText('Signed in as @giovanna_crochet')).toBeInTheDocument();
      await user.type(screen.getByLabelText('Bio (optional)'), 'Amigurumi every day');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
      expect(patches).toEqual([
        { displayName: 'Giovanna', bio: 'Amigurumi every day', language: 'en' },
      ]);

      await user.click(screen.getByRole('button', { name: 'Sign out' }));
      expect(auth.signOut).toHaveBeenCalled();
    });

    it('shows an error when the session cannot start', async () => {
      stubApi({
        ...health,
        'GET /api/me': () => json({ error: 'internal', message: 'down' }, 500),
      });
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      renderApp({ auth: fakeAuthClient(true) });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('We could not reach WeHobby');
      });
    });
  });
});
