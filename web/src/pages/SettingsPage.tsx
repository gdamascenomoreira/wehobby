import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  UpdateProfileSchema,
  type Language,
  type Profile,
} from '@wehobby/shared';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../auth/session';
import { Field } from '../components/Field';
import { LanguageSelect } from '../components/LanguageSelect';

type FieldName = 'displayName' | 'bio';

export function SettingsPage({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const { updateProfile, signOut } = useSession();

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [language, setLanguage] = useState<Language>(profile.language);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [result, setResult] = useState<'saved' | 'error' | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    const parsed = UpdateProfileSchema.safeParse({ displayName, bio, language });
    if (!parsed.success) {
      const fields = new Set(parsed.error.issues.map((issue) => issue.path[0]));
      setErrors({
        ...(fields.has('displayName') && { displayName: t('profile.displayName.invalid') }),
        ...(fields.has('bio') && { bio: t('profile.bio.invalid') }),
      });
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      await updateProfile(parsed.data);
      setResult('saved');
    } catch {
      setResult('error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <h1>{t('settings.title')}</h1>
      <p>{t('settings.account', { username: profile.username })}</p>

      <form className="form" noValidate onSubmit={(event) => void handleSubmit(event)}>
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

        <LanguageSelect value={language} onChange={setLanguage} />

        {result && (
          <p
            className={result === 'saved' ? 'form__success' : 'form__error'}
            role={result === 'saved' ? 'status' : 'alert'}
          >
            {result === 'saved' ? t('settings.saved') : t('form.error')}
          </p>
        )}

        <button type="submit" className="button button--primary" disabled={saving}>
          {saving ? t('form.saving') : t('settings.save')}
        </button>
      </form>

      <button type="button" className="button" onClick={() => void signOut()}>
        {t('settings.signOut')}
      </button>
    </main>
  );
}
