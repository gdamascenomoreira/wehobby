import { useTranslation } from 'react-i18next';
import { ApiStatus } from './components/ApiStatus';
import { LanguagePicker } from './components/LanguagePicker';

export function App() {
  const { t } = useTranslation();

  return (
    <>
      <header className="app-header">
        <LanguagePicker />
      </header>
      <main className="home">
        <h1 className="home__title">{t('app.name')}</h1>
        <p className="home__tagline">{t('app.tagline')}</p>
        <ApiStatus />
      </main>
    </>
  );
}
