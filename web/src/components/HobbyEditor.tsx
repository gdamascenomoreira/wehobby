import { UpdateMyHobbiesSchema, type MyHobby } from '@wehobby/shared';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../auth/session';
import { HobbyPicker } from './HobbyPicker';
import { SuggestTypeForm } from './SuggestTypeForm';
import { useHobbyCatalog } from './useHobbyCatalog';

interface HobbyEditorProps {
  submitLabel: string;
  /** Called after a successful save. */
  onSaved?: () => void;
  /** Shows "Changes saved." after saving, for pages the user stays on. */
  confirmSave?: boolean;
}

/** Loads the catalog, edits the user's hobbies with HobbyPicker and saves them. */
export function HobbyEditor({ submitLabel, onSaved, confirmSave = false }: HobbyEditorProps) {
  const { t } = useTranslation();
  const { hobbies, saveHobbies } = useSession();
  const catalog = useHobbyCatalog();

  const [value, setValue] = useState<MyHobby[]>(hobbies);
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<'saved' | 'error' | null>(null);
  const [saving, setSaving] = useState(false);

  if (catalog.status === 'loading') {
    return <p role="status">{t('session.loading')}</p>;
  }
  if (catalog.status === 'error') {
    return <p role="alert">{t('hobbyPicker.loadError')}</p>;
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    const parsed = UpdateMyHobbiesSchema.safeParse({ hobbies: value });
    if (!parsed.success) {
      setError(t('hobbyPicker.required'));
      return;
    }

    setError(undefined);
    setSaving(true);
    try {
      await saveHobbies(parsed.data);
      if (confirmSave) setResult('saved');
      onSaved?.();
    } catch {
      setResult('error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form className="form" noValidate onSubmit={(event) => void handleSubmit(event)}>
        <HobbyPicker
          catalog={catalog.hobbies}
          value={value}
          onChange={(next) => {
            setValue(next);
            setError(undefined);
            setResult(null);
          }}
          error={error}
        />

        {result && (
          <p
            className={result === 'saved' ? 'form__success' : 'form__error'}
            role={result === 'saved' ? 'status' : 'alert'}
          >
            {result === 'saved' ? t('settings.saved') : t('form.error')}
          </p>
        )}

        <button type="submit" className="button button--primary" disabled={saving}>
          {saving ? t('form.saving') : submitLabel}
        </button>
      </form>

      {/* Outside the form above: forms cannot be nested. */}
      <SuggestTypeForm catalog={catalog.hobbies} />
    </>
  );
}
