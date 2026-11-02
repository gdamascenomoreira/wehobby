import { TYPE_SUGGESTION_NAME_MAX_LENGTH, TypeSuggestionSchema, type Hobby } from '@wehobby/shared';
import { useId, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiRequestError } from '../api/client';
import { useSession } from '../auth/session';
import { Field } from './Field';
import { useHobbyLabels } from './useHobbyLabels';

type Result = 'sent' | 'rateLimited' | 'error' | null;

/** A link-like toggle that opens a small form to suggest a new hobby type for review. */
export function SuggestTypeForm({ catalog }: { catalog: Hobby[] }) {
  const { t } = useTranslation();
  const { hobbyName } = useHobbyLabels();
  const { suggestType } = useSession();
  const formId = useId();

  const [open, setOpen] = useState(false);
  const [hobbyId, setHobbyId] = useState(catalog[0]?.id ?? '');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [result, setResult] = useState<Result>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    const parsed = TypeSuggestionSchema.safeParse({ hobbyId, name });
    if (!parsed.success) {
      setNameError(t('suggestType.name.invalid'));
      return;
    }

    setNameError(undefined);
    setSending(true);
    try {
      await suggestType(parsed.data);
      setResult('sent');
      setName('');
    } catch (error) {
      setResult(error instanceof ApiRequestError && error.status === 429 ? 'rateLimited' : 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="suggest-type">
      <button
        type="button"
        className="link-button"
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {t('suggestType.open')}
      </button>

      {open && (
        <form
          id={formId}
          className="form"
          noValidate
          aria-label={t('suggestType.title')}
          onSubmit={(event) => void handleSubmit(event)}
        >
          <p className="field__hint">{t('suggestType.intro')}</p>
          <Field label={t('suggestType.hobby')}>
            {(props) => (
              <select
                {...props}
                name="hobbyId"
                value={hobbyId}
                onChange={(event) => {
                  setHobbyId(event.target.value);
                }}
              >
                {catalog.map((hobby) => (
                  <option key={hobby.id} value={hobby.id}>
                    {hobbyName(hobby.id)}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label={t('suggestType.name.label')} error={nameError}>
            {(props) => (
              <input
                {...props}
                name="name"
                maxLength={TYPE_SUGGESTION_NAME_MAX_LENGTH}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
            )}
          </Field>

          {result && (
            <p
              className={result === 'sent' ? 'form__success' : 'form__error'}
              role={result === 'sent' ? 'status' : 'alert'}
            >
              {result === 'sent'
                ? t('suggestType.sent')
                : result === 'rateLimited'
                  ? t('suggestType.rateLimited')
                  : t('form.error')}
            </p>
          )}

          <button type="submit" className="button" disabled={sending}>
            {sending ? t('form.saving') : t('suggestType.submit')}
          </button>
        </form>
      )}
    </div>
  );
}
