import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { useSession } from '../auth/session';
import { AddAreaCard } from '../components/AddAreaCard';
import { ApiStatus } from '../components/ApiStatus';
import { HobbyIcon } from '../components/HobbyIcon';
import { useHobbyLabels } from '../components/useHobbyLabels';

export function HomePage() {
  const { t } = useTranslation();
  const { hobbyName, typeName } = useHobbyLabels();
  const { status, profile, hobbies, signIn } = useSession();

  if (status === 'needsProfile') {
    return <Navigate to="/onboarding" replace />;
  }

  if (status === 'needsHobbies') {
    return <Navigate to="/onboarding/hobbies" replace />;
  }

  if (status === 'ready' && profile) {
    return (
      <main className="page home">
        <h1 className="home__title">{t('home.welcome', { name: profile.displayName })}</h1>
        <p className="home__tagline">
          @{profile.username}
          {profile.location && ` · ${profile.location.label}`}
        </p>
        {!profile.location && <AddAreaCard />}
        <section className="my-hobbies" aria-labelledby="my-hobbies-title">
          <h2 id="my-hobbies-title">{t('home.yourHobbies')}</h2>
          <ul className="my-hobbies__list">
            {hobbies.map((hobby) => (
              <li key={hobby.hobbyId} className="my-hobbies__item">
                <HobbyIcon hobbyId={hobby.hobbyId} />
                <span>
                  <strong>{hobbyName(hobby.hobbyId)}</strong>
                  {hobby.typeIds.length > 0 && (
                    <span className="my-hobbies__types">
                      {hobby.typeIds.map((typeId) => typeName(hobby.hobbyId, typeId)).join(', ')}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
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
