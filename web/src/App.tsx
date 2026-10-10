import { useTranslation } from 'react-i18next';
import { Link, Navigate, Route, Routes } from 'react-router';
import { useSession } from './auth/session';
import { LanguagePicker } from './components/LanguagePicker';
import { HomePage } from './pages/HomePage';
import { OnboardingPage } from './pages/OnboardingPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  const { t } = useTranslation();
  const { status } = useSession();

  return (
    <>
      <header className="app-header">
        <Link to="/" className="app-header__brand" aria-label={t('nav.home')}>
          {t('app.name')}
        </Link>
        <nav className="app-header__nav">
          {status === 'ready' && <Link to="/settings">{t('nav.settings')}</Link>}
          <LanguagePicker />
        </nav>
      </header>
      <AppRoutes />
    </>
  );
}

function AppRoutes() {
  const { t } = useTranslation();
  const { status, profile } = useSession();

  if (status === 'loading') {
    return (
      <main className="page home">
        <p role="status">{t('session.loading')}</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="page home">
        <p role="alert">{t('session.error')}</p>
        <button
          type="button"
          className="button"
          onClick={() => {
            window.location.reload();
          }}
        >
          {t('session.retry')}
        </button>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/onboarding"
        element={status === 'needsProfile' ? <OnboardingPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/settings"
        element={
          status === 'ready' && profile ? (
            <SettingsPage profile={profile} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
