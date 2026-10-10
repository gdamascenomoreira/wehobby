import { LANGUAGES, LanguageSchema, type Language } from '@wehobby/shared';
import { useTranslation } from 'react-i18next';
import { Field } from './Field';

interface LanguageSelectProps {
  value: Language;
  onChange: (language: Language) => void;
}

/** The language saved in the user's profile. */
export function LanguageSelect({ value, onChange }: LanguageSelectProps) {
  const { t } = useTranslation();

  return (
    <Field label={t('profile.language.label')}>
      {(props) => (
        <select
          {...props}
          name="language"
          value={value}
          onChange={(event) => {
            const parsed = LanguageSchema.safeParse(event.target.value);
            if (parsed.success) onChange(parsed.data);
          }}
        >
          {LANGUAGES.map((language) => (
            <option key={language} value={language} lang={language}>
              {t(`language.${language}`)}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
