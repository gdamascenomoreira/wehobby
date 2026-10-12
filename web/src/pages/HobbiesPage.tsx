import { SetUserHobbiesSchema, type Hobby, type Profile } from '@wehobby/shared';
import { useEffect, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { fetchHobbyCatalog } from '../api/hobbies';
import { useSession } from '../auth/session';
import { useHobbyNames } from '../components/hobbyNames';

/** Picked type ids, keyed by picked hobby id. */
type Selection = Map<string, Set<string>>;

function selectionOf(profile: Profile): Selection {
  return new Map(profile.hobbies.map((hobby) => [hobby.hobbyId, new Set(hobby.typeIds)]));
}

/**
 * Pick hobbies and, per hobby, optional types. New users land here after
 * creating their profile; others reach it from settings.
 */
export function HobbiesPage({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const names = useHobbyNames();
  const navigate = useNavigate();
  const { setHobbies } = useSession();
  const isOnboarding = profile.hobbies.length === 0;

  const [catalog, setCatalog] = useState<Hobby[] | 'loading' | 'error'>('loading');
  const [selection, setSelection] = useState<Selection>(() => selectionOf(profile));
  const [error, setError] = useState<'empty' | 'save' | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchHobbyCatalog(controller.signal).then(setCatalog, () => {
      if (!controller.signal.aborted) setCatalog('error');
    });
    return () => {
      controller.abort();
    };
  }, []);

  function toggleHobby(hobbyId: string, checked: boolean) {
    setSelection((current) => {
      const next = new Map(current);
      if (checked) next.set(hobbyId, new Set());
      else next.delete(hobbyId);
      return next;
    });
    setError(null);
  }

  function toggleType(hobbyId: string, typeId: string, checked: boolean) {
    setSelection((current) => {
      const next = new Map(current);
      const types = new Set(next.get(hobbyId));
      if (checked) types.add(typeId);
      else types.delete(typeId);
      next.set(hobbyId, types);
      return next;
    });
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Array.isArray(catalog)) return;

    // Keep the catalog order, and drop hobbies that are no longer offered.
    const parsed = SetUserHobbiesSchema.safeParse({
      hobbies: catalog
        .filter((hobby) => selection.has(hobby.id))
        .map((hobby) => ({
          hobbyId: hobby.id,
          typeIds: hobby.types
            .map((type) => type.id)
            .filter((typeId) => selection.get(hobby.id)?.has(typeId)),
        })),
    });
    if (!parsed.success) {
      setError('empty');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await setHobbies(parsed.data);
      void navigate('/', { replace: true });
    } catch {
      setError('save');
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <h1>{t(isOnboarding ? 'hobbies.onboardingTitle' : 'hobbies.title')}</h1>
      <p>{t('hobbies.intro')}</p>

      {catalog === 'loading' && <p role="status">{t('session.loading')}</p>}
      {catalog === 'error' && <p role="alert">{t('form.error')}</p>}

      {Array.isArray(catalog) && (
        <form className="form" noValidate onSubmit={(event) => void handleSubmit(event)}>
          {catalog.map((hobby) => {
            const picked = selection.get(hobby.id);
            const hobbyName = names.hobby(hobby.id);
            return (
              <div key={hobby.id} className="hobby">
                <div className="field field--checkbox">
                  <input
                    id={`hobby-${hobby.id}`}
                    type="checkbox"
                    checked={picked !== undefined}
                    onChange={(event) => {
                      toggleHobby(hobby.id, event.target.checked);
                    }}
                  />
                  <label htmlFor={`hobby-${hobby.id}`} className="hobby__name">
                    {hobbyName}
                  </label>
                </div>

                {picked && hobby.types.length > 0 && (
                  <fieldset className="hobby__types">
                    <legend>{t('hobbies.typesLegend', { hobby: hobbyName })}</legend>
                    {hobby.types.map((type) => {
                      const id = `hobby-${hobby.id}-${type.id}`;
                      return (
                        <div key={type.id} className="field field--checkbox">
                          <input
                            id={id}
                            type="checkbox"
                            checked={picked.has(type.id)}
                            onChange={(event) => {
                              toggleType(hobby.id, type.id, event.target.checked);
                            }}
                          />
                          <label htmlFor={id}>{names.type(hobby.id, type.id)}</label>
                        </div>
                      );
                    })}
                  </fieldset>
                )}
              </div>
            );
          })}

          {error && (
            <p className="form__error" role="alert">
              {error === 'empty' ? t('hobbies.pickOne') : t('form.error')}
            </p>
          )}

          <button type="submit" className="button button--primary" disabled={saving}>
            {saving ? t('form.saving') : t(isOnboarding ? 'hobbies.continue' : 'hobbies.save')}
          </button>
        </form>
      )}
    </main>
  );
}
