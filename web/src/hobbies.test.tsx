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

const base: ApiRoutes = {
  'GET /api/health': () => json({ status: 'ok', version: 'test' }),
  'GET /api/me': () => json(giovanna),
  'GET /api/hobbies': () => json(hobbyCatalog),
};

describe('hobbies', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('hobby step', () => {
    it('sends a user with a profile but no hobbies to the hobby step', async () => {
      stubApi({ ...base, 'GET /api/me/hobbies': () => json({ hobbies: [] }) });
      renderApp({ auth: fakeAuthClient(true) });

      expect(await screen.findByRole('heading', { name: 'Pick your hobbies' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    });

    it('asks for at least one hobby before saving', async () => {
      const fetchMock = stubApi({ ...base, 'GET /api/me/hobbies': () => json({ hobbies: [] }) });
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(true) });

      await user.click(await screen.findByRole('button', { name: 'Continue' }));

      expect(screen.getByText('Pick at least one hobby.')).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalledWith(
        '/api/me/hobbies',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('saves crochet with amigurumi, then shows them on the home page', async () => {
      const saved: unknown[] = [];
      stubApi({
        ...base,
        'GET /api/me/hobbies': () => json({ hobbies: [] }),
        'PUT /api/me/hobbies': (body) => {
          saved.push(body);
          return json(giovannaHobbies);
        },
      });
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(true) });

      // Types show only once their hobby is picked.
      await screen.findByRole('heading', { name: 'Pick your hobbies' });
      expect(screen.queryByRole('checkbox', { name: 'Amigurumi' })).not.toBeInTheDocument();
      await user.click(await screen.findByRole('checkbox', { name: 'Crochet' }));
      const types = screen.getByRole('group', { name: 'What do you like in Crochet?' });
      await user.click(within(types).getByRole('checkbox', { name: 'Amigurumi' }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(await screen.findByRole('heading', { name: 'Hello, Giovanna!' })).toBeInTheDocument();
      expect(saved).toEqual([{ hobbies: [{ hobbyId: 'crochet', typeIds: ['amigurumi'] }] }]);
      const mine = screen.getByRole('region', { name: 'Your hobbies' });
      expect(within(mine).getByText('Crochet')).toBeInTheDocument();
      expect(within(mine).getByText('Amigurumi')).toBeInTheDocument();
    });

    it('sends a type suggestion', async () => {
      const suggestions: unknown[] = [];
      stubApi({
        ...base,
        'GET /api/me/hobbies': () => json({ hobbies: [] }),
        'POST /api/hobby-types/suggestions': (body) => {
          suggestions.push(body);
          return new Response(null, { status: 202 });
        },
      });
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(true) });

      const open = await screen.findByRole('button', { name: 'Suggest a type' });
      expect(open).toHaveAttribute('aria-expanded', 'false');
      await user.click(open);
      await user.selectOptions(screen.getByLabelText('Hobby'), 'plants');
      await user.type(screen.getByLabelText('Type name'), '  Carnivorous plants ');
      await user.click(screen.getByRole('button', { name: 'Send suggestion' }));

      expect(
        await screen.findByText('Thank you! We will review your suggestion.'),
      ).toBeInTheDocument();
      expect(suggestions).toEqual([{ hobbyId: 'plants', name: 'Carnivorous plants' }]);
    });

    it('rejects a suggestion name that is too short', async () => {
      stubApi({ ...base, 'GET /api/me/hobbies': () => json({ hobbies: [] }) });
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(true) });

      await user.click(await screen.findByRole('button', { name: 'Suggest a type' }));
      await user.type(screen.getByLabelText('Type name'), 'x');
      await user.click(screen.getByRole('button', { name: 'Send suggestion' }));

      expect(screen.getByText('Use 2 to 40 characters.')).toBeInTheDocument();
    });
  });

  describe('settings', () => {
    it('changes the hobbies from Settings', async () => {
      const saved: unknown[] = [];
      stubApi({
        ...base,
        'GET /api/me/hobbies': () => json(giovannaHobbies),
        'PUT /api/me/hobbies': (body) => {
          saved.push(body);
          return json({ hobbies: [{ hobbyId: 'plants', typeIds: [] }] });
        },
      });
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(true), path: '/settings' });

      const section = await screen.findByRole('region', { name: 'Your hobbies' });
      const crochet = await within(section).findByRole('checkbox', { name: 'Crochet' });
      expect(crochet).toBeChecked();
      expect(within(section).getByRole('checkbox', { name: 'Amigurumi' })).toBeChecked();

      await user.click(crochet);
      await user.click(within(section).getByRole('checkbox', { name: 'Plants' }));
      await user.click(within(section).getByRole('button', { name: 'Save hobbies' }));

      expect(await within(section).findByText('Changes saved.')).toBeInTheDocument();
      expect(saved).toEqual([{ hobbies: [{ hobbyId: 'plants', typeIds: [] }] }]);
    });
  });

  describe('languages', () => {
    it('shows hobby and type names in Portuguese', async () => {
      stubApi({
        ...base,
        'GET /api/me': () => json({ ...giovanna, language: 'pt' }),
        'GET /api/me/hobbies': () => json({ hobbies: [{ hobbyId: 'plants', typeIds: [] }] }),
      });
      const user = userEvent.setup();
      renderApp({ auth: fakeAuthClient(true), path: '/settings' });

      const section = await screen.findByRole('region', { name: 'Os teus hobbies' });
      expect(await within(section).findByRole('checkbox', { name: 'Croché' })).toBeInTheDocument();
      expect(within(section).getByRole('checkbox', { name: 'Fotografia' })).toBeInTheDocument();
      expect(
        within(section).getByRole('checkbox', { name: 'Suculentas e cactos' }),
      ).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText('Idioma'), 'en');
      expect(
        await screen.findByRole('checkbox', { name: 'Succulents and cacti' }),
      ).toBeInTheDocument();
    });

    it('has a name for every seeded hobby and type in both languages', () => {
      // Kept in sync with the seed in api/drizzle/0001_hobbies.sql.
      const seed: Record<string, string[]> = {
        crochet: [
          'amigurumi',
          'granny_squares',
          'tapestry',
          'garments',
          'accessories',
          'home_decor',
          'blankets',
        ],
        plants: [
          'houseplants',
          'succulents_cacti',
          'orchids',
          'vegetable_garden',
          'herbs',
          'bonsai',
          'propagation',
        ],
        photography: [
          'landscape',
          'portrait',
          'street',
          'macro',
          'nature_wildlife',
          'film',
          'mobile',
        ],
      };
      for (const language of ['pt', 'en']) {
        for (const [hobbyId, typeIds] of Object.entries(seed)) {
          const keys = [
            `hobbies.${hobbyId}.name`,
            ...typeIds.map((id) => `hobbies.${hobbyId}.types.${id}`),
          ];
          for (const key of keys) {
            expect(i18n.exists(key, { lng: language }), `${language}: ${key}`).toBe(true);
          }
        }
      }
    });
  });
});
