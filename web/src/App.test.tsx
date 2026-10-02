import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import i18n, { LANGUAGE_STORAGE_KEY } from './i18n';

function mockHealthResponse(response: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(response)),
  );
}

describe('App', () => {
  beforeEach(async () => {
    mockHealthResponse(Response.json({ status: 'ok', version: 'test' }));
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the API status from /health', async () => {
    render(<App />);

    expect(await screen.findByText('API status: ok')).toBeInTheDocument();
  });

  it('shows the API as unavailable when /health fails', async () => {
    mockHealthResponse(new Response(null, { status: 503 }));
    render(<App />);

    expect(await screen.findByText('API status: unavailable')).toBeInTheDocument();
  });

  it('switches the language between English and Portuguese', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText('API status: ok')).toBeInTheDocument();
    expect(screen.getByText('Share the everyday side of your hobby.')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Language'), 'pt');

    expect(screen.getByText('Partilha o dia a dia do teu hobby.')).toBeInTheDocument();
    expect(screen.getByText('Estado da API: ok')).toBeInTheDocument();
    expect(screen.getByLabelText('Idioma')).toHaveValue('pt');
    expect(document.documentElement.lang).toBe('pt');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pt');

    await user.selectOptions(screen.getByLabelText('Idioma'), 'en');

    expect(screen.getByText('Share the everyday side of your hobby.')).toBeInTheDocument();
  });
});
