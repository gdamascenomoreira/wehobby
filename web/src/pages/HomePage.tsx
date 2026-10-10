import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { useSession } from '../auth/session';
import { ApiStatus } from '../components/ApiStatus';

export function HomePage() {
  const { t } = useTranslation();
  const { status, profile, signIn } = useSession();

  if (status === 'needsProfile') {
    return <Navigate to="/onboarding" replace />;
  }

  if (status === 'ready' && profile) {
    return (
      <main className="page home">
        <h1 className="home__title">{t('home.welcome', { name: profile.displayName })}</h1>
        <p className="home__tagline">@{profile.username}</p>
        <p>{t('home.comingSoon')}</p>
      </main>
    );
  }

  return (
    <main className="page home">
      <h1 className="home__title">{t('app.name')}</h1>
      <p className="home__tagline">{t('app.tagline')}</p>
      <p>{t('signIn.intro')}</p>
      <button type="button" className="button button--primary" onClick={() => void signIn()}>
        {t('signIn.button')}
      </button>
      <p className="home__hint">{t('signIn.hint')}</p>
      <ApiStatus />
    </main>
  );
}
