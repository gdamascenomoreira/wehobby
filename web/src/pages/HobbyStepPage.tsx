import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { HobbyEditor } from '../components/HobbyEditor';

/** The onboarding step after the profile: pick at least one hobby. */
export function HobbyStepPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <main className="page">
      <h1>{t('hobbyStep.title')}</h1>
      <p>{t('hobbyStep.intro')}</p>
      <HobbyEditor
        submitLabel={t('hobbyStep.submit')}
        onSaved={() => {
          void navigate('/', { replace: true });
        }}
      />
    </main>
  );
}
