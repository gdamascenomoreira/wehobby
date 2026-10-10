import { useId, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function LanguagePicker() {
  const { t, i18n } = useTranslation();
  const id = useId();
  const current = i18n.resolvedLanguage ?? 'en';

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const { value } = event.target;
    if (isSupportedLanguage(value)) {
      void i18n.changeLanguage(value);
    }
  }

  return (
    <div className="language-picker">
      <label htmlFor={id}>{t('language.label')}</label>
      <select id={id} value={current} onChange={handleChange}>
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language} value={language} lang={language}>
            {t(`language.${language}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
