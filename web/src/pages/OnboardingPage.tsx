import {
  BIO_MAX_LENGTH,
  CreateProfileSchema,
  DISPLAY_NAME_MAX_LENGTH,
  LanguageSchema,
  USERNAME_MAX_LENGTH,
  UsernameSchema,
  type Language,
} from '@wehobby/shared';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ApiRequestError } from '../api/client';
import { useSession } from '../auth/session';
import { Field } from '../components/Field';
import { LanguageSelect } from '../components/LanguageSelect';

type FieldName = 'username' | 'displayName' | 'bio' | 'ageConfirmed';
type Errors = Partial<Record<FieldName, string | undefined>>;

export function OnboardingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { createProfile, isUsernameAvailable } = useSession();

  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [language, setLanguage] = useState<Language>(
    LanguageSchema.catch('en').parse(i18n.resolvedLanguage),
  );
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const errorMessages: Record<FieldName, string> = {
    username: t('profile.username.invalid'),
    displayName: t('profile.displayName.invalid'),
    bio: t('profile.bio.invalid'),
    ageConfirmed: t('profile.age.invalid'),
  };

  async function handleUsernameBlur() {
    setUsernameAvailable(false);
    const parsed = UsernameSchema.safeParse(username);
    if (!parsed.success) {
      if (username) setErrors((current) => ({ ...current, username: errorMessages.username }));
      return;
    }
    try {
      const available = await isUsernameAvailable(parsed.data);
      setUsernameAvailable(available);
      setErrors((current) => ({
        ...current,
        username: available ? undefined : t('profile.username.taken'),
      }));
    } catch {
      // The check is only a convenience; the server checks again on submit.
    }
  }

  function handleLanguageChange(next: Language) {
    setLanguage(next);
    void i18n.changeLanguage(next);
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(false);

    const parsed = CreateProfileSchema.safeParse({
      username,
      displayName,
      ...(bio.trim() && { bio }),
      language,
      ageConfirmed,
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FieldName;
        next[field] = errorMessages[field];
      }
      setErrors(next);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await createProfile(parsed.data);
      void navigate('/', { replace: true });
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'username_taken') {
        setUsernameAvailable(false);
        setErrors({ username: t('profile.username.taken') });
      } else {
        setFormError(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <h1>{t('onboarding.title')}</h1>
      <p>{t('onboarding.intro')}</p>

      <form className="form" noValidate onSubmit={(event) => void handleSubmit(event)}>
        <Field
          label={t('profile.username.label')}
          hint={t('profile.username.hint')}
          error={errors.username}
          success={usernameAvailable ? t('profile.username.available') : undefined}
        >
          {(props) => (
            <input
              {...props}
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={USERNAME_MAX_LENGTH}
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setUsernameAvailable(false);
              }}
              onBlur={() => void handleUsernameBlur()}
            />
          )}
        </Field>

        <Field label={t('profile.displayName.label')} error={errors.displayName}>
          {(props) => (
            <input
              {...props}
              name="displayName"
              autoComplete="nickname"
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
              }}
            />
          )}
        </Field>

        <Field label={t('profile.bio.label')} error={errors.bio}>
          {(props) => (
            <textarea
              {...props}
              name="bio"
              rows={3}
              maxLength={BIO_MAX_LENGTH}
              value={bio}
              onChange={(event) => {
                setBio(event.target.value);
              }}
            />
          )}
        </Field>

        <LanguageSelect value={language} onChange={handleLanguageChange} />

        <div className="field field--checkbox">
          <input
            id="age-confirmed"
            type="checkbox"
            checked={ageConfirmed}
            aria-invalid={errors.ageConfirmed !== undefined}
            aria-describedby={errors.ageConfirmed ? 'age-confirmed-error' : undefined}
            onChange={(event) => {
              setAgeConfirmed(event.target.checked);
            }}
          />
          <label htmlFor="age-confirmed">{t('profile.age.label')}</label>
          {errors.ageConfirmed && (
            <p id="age-confirmed-error" className="field__error" role="alert">
              {errors.ageConfirmed}
            </p>
          )}
        </div>

        {formError && (
          <p className="form__error" role="alert">
            {t('form.error')}
          </p>
        )}

        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? t('form.saving') : t('onboarding.submit')}
        </button>
      </form>
    </main>
  );
}
