import {
  PLACE_QUERY_MAX_LENGTH,
  PLACE_QUERY_MIN_LENGTH,
  roundCoordinate,
  type MyLocation,
  type Place,
  type UpdateMyLocation,
} from '@wehobby/shared';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiRequestError } from '../api/client';
import { useSession } from '../auth/session';
import { useDebouncedValue } from './useDebouncedValue';

export const SEARCH_DEBOUNCE_MS = 300;
const GEOLOCATION_TIMEOUT_MS = 10_000;

type Message = 'denied' | 'unavailable' | 'noPlaceHere' | 'saveError' | null;

/** The answer to one search, kept with its query so stale answers are ignored. */
interface SearchResult {
  query: string;
  places: Place[];
  failed: boolean;
}

interface LocationPickerProps {
  onSaved: (location: MyLocation) => void;
}

/** The browser position, rounded to about 1 km before it leaves this function. */
function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: roundCoordinate(position.coords.latitude),
          lng: roundCoordinate(position.coords.longitude),
        });
      },
      (error) => {
        reject(new Error(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'));
      },
      { enableHighAccuracy: false, timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 600_000 },
    );
  });
}

/**
 * Sets the user's approximate area: from the browser position, or by
 * searching for a city. Used in onboarding, from Home and in Settings.
 */
export function LocationPicker({ onSaved }: LocationPickerProps) {
  const { t } = useTranslation();
  const { searchPlaces, setLocation } = useSession();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState<'locating' | 'saving' | null>(null);
  const [message, setMessage] = useState<Message>(null);

  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

  const searchable = debouncedQuery.length >= PLACE_QUERY_MIN_LENGTH;
  const current = searchable && search?.query === debouncedQuery ? search : undefined;
  const searching = searchable && !current;
  const results = current?.places ?? [];

  useEffect(() => {
    if (!searchable) return;
    const controller = new AbortController();
    searchPlaces(debouncedQuery, controller.signal).then(
      (places) => {
        setSearch({ query: debouncedQuery, places, failed: false });
      },
      () => {
        if (controller.signal.aborted) return;
        setSearch({ query: debouncedQuery, places: [], failed: true });
      },
    );
    return () => {
      controller.abort();
    };
  }, [debouncedQuery, searchable, searchPlaces]);

  async function save(input: UpdateMyLocation) {
    setBusy('saving');
    setMessage(null);
    try {
      onSaved(await setLocation(input));
    } catch (error) {
      setMessage(
        error instanceof ApiRequestError && error.code === 'no_place_here'
          ? 'noPlaceHere'
          : 'saveError',
      );
    } finally {
      setBusy(null);
    }
  }

  async function locateMe() {
    setBusy('locating');
    setMessage(null);
    let point;
    try {
      point = await currentPosition();
    } catch (error) {
      setBusy(null);
      setMessage(error instanceof Error && error.message === 'denied' ? 'denied' : 'unavailable');
      // Point the user to the alternative.
      inputRef.current?.focus();
      return;
    }
    await save(point);
  }

  function pick(place: Place) {
    setQuery(place.label);
    setOpen(false);
    void save({ placeId: place.id });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === 'Enter' && open && active >= 0) {
      event.preventDefault();
      const place = results[active];
      if (place) pick(place);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  const listId = `${id}-places`;
  const optionId = (index: number) => `${id}-place-${String(index)}`;
  const showList = open && results.length > 0;

  return (
    <div className="location-picker">
      <p className="location-picker__consent">{t('location.consent')}</p>

      <button
        type="button"
        className="button button--primary"
        disabled={busy !== null}
        onClick={() => void locateMe()}
      >
        {busy === 'locating' ? t('location.locating') : t('location.useCurrent')}
      </button>

      <p className="location-picker__or">{t('location.or')}</p>

      <div className="field location-picker__search">
        <label htmlFor={`${id}-input`}>{t('location.search.label')}</label>
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          aria-describedby={`${id}-hint`}
          maxLength={PLACE_QUERY_MAX_LENGTH}
          value={query}
          disabled={busy === 'saving'}
          onChange={(event) => {
            setQuery(event.target.value);
            setMessage(null);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Let a click on an option land first.
            setTimeout(() => {
              setOpen(false);
            }, 150);
          }}
        />
        <p id={`${id}-hint`} className="field__hint">
          {t('location.search.hint', { count: PLACE_QUERY_MIN_LENGTH })}
        </p>
        <ul
          id={listId}
          role="listbox"
          aria-label={t('location.search.results')}
          className="location-picker__list"
          hidden={!showList}
        >
          {results.map((place, index) => (
            <li
              key={place.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              className="location-picker__option"
              onMouseDown={(event) => {
                // Keep focus in the input until the pick is handled.
                event.preventDefault();
              }}
              onClick={() => {
                pick(place);
              }}
            >
              {place.label}
            </li>
          ))}
        </ul>
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        {searching
          ? t('location.search.searching')
          : current && !current.failed
            ? t('location.search.count', { count: results.length })
            : ''}
      </p>

      {busy === 'saving' && <p role="status">{t('form.saving')}</p>}
      {current?.failed && (
        <p className="form__error" role="alert">
          {t('location.messages.searchError')}
        </p>
      )}
      {current && !current.failed && results.length === 0 && (
        <p className="field__hint">{t('location.messages.noResults')}</p>
      )}
      {message && (
        <p className="form__error" role="alert">
          {t(`location.messages.${message}`)}
        </p>
      )}
    </div>
  );
}
