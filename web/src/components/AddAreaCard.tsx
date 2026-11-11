import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export const ADD_AREA_DISMISSED_KEY = 'wehobby.addAreaCard.dismissed';

function isDismissed(): boolean {
  try {
    return localStorage.getItem(ADD_AREA_DISMISSED_KEY) === 'true';
  } catch {
    // Storage blocked (private mode, cleared site data): show the card.
    return false;
  }
}

function rememberDismissed() {
  try {
    localStorage.setItem(ADD_AREA_DISMISSED_KEY, 'true');
  } catch {
    // Not remembered; the card comes back next visit.
  }
}

/** Invites existing users without a location to add one. Never forced. */
export function AddAreaCard() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(isDismissed);

  if (dismissed) return null;

  return (
    <aside className="add-area" aria-labelledby="add-area-title">
      <h2 id="add-area-title" className="add-area__title">
        {t('addArea.title')}
      </h2>
      <p>{t('addArea.body')}</p>
      <div className="add-area__actions">
        <Link to="/onboarding/location" className="button button--primary">
          {t('addArea.add')}
        </Link>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            rememberDismissed();
            setDismissed(true);
          }}
        >
          {t('addArea.dismiss')}
        </button>
      </div>
    </aside>
  );
}
