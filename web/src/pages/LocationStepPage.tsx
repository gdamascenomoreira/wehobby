import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { LocationPicker } from '../components/LocationPicker';

/**
 * The optional onboarding step after the hobbies: share an approximate area.
 * Also opened from the "add your area" card on Home.
 */
export function LocationStepPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const goHome = () => {
    void navigate('/', { replace: true });
  };

  return (
    <main className="page">
      <h1>{t('locationStep.title')}</h1>
      <p>{t('locationStep.intro')}</p>
      <LocationPicker onSaved={goHome} />
      <button type="button" className="link-button" onClick={goHome}>
        {t('locationStep.skip')}
      </button>
    </main>
  );
}
