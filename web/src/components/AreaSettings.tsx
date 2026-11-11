import type { MyLocation } from '@wehobby/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../auth/session';
import { LocationPicker } from './LocationPicker';

type Mode = 'view' | 'change' | 'confirmRemove';

/** "Your area" in Settings: shows the label, change it, or remove it after a confirm step. */
export function AreaSettings({ location }: { location: MyLocation | null }) {
  const { t } = useTranslation();
  const { clearLocation } = useSession();
  const [mode, setMode] = useState<Mode>('view');
  const [status, setStatus] = useState<'saved' | 'removed' | 'error' | null>(null);
  const [removing, setRemoving] = useState(false);

  async function remove() {
    setRemoving(true);
    try {
      await clearLocation();
      setStatus('removed');
      setMode('view');
    } catch {
      setStatus('error');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="settings__section" aria-labelledby="settings-area">
      <h2 id="settings-area">{t('settings.area.title')}</h2>
      <p>{location ? location.label : t('settings.area.none')}</p>

      {mode === 'change' && (
        <>
          <LocationPicker
            onSaved={() => {
              setStatus('saved');
              setMode('view');
            }}
          />
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setMode('view');
            }}
          >
            {t('settings.area.cancel')}
          </button>
        </>
      )}

      {mode === 'view' && (
        <div className="area-settings__actions">
          <button
            type="button"
            className="button"
            onClick={() => {
              setStatus(null);
              setMode('change');
            }}
          >
            {location ? t('settings.area.change') : t('settings.area.add')}
          </button>
          {location && (
            <button
              type="button"
              className="button"
              onClick={() => {
                setStatus(null);
                setMode('confirmRemove');
              }}
            >
              {t('settings.area.remove')}
            </button>
          )}
        </div>
      )}

      {mode === 'confirmRemove' && (
        <div
          className="area-settings__confirm"
          role="group"
          aria-labelledby="settings-area-confirm"
        >
          <p id="settings-area-confirm">{t('settings.area.confirmText')}</p>
          <div className="area-settings__actions">
            <button
              type="button"
              className="button button--primary"
              disabled={removing}
              autoFocus
              onClick={() => void remove()}
            >
              {t('settings.area.confirmRemove')}
            </button>
            <button
              type="button"
              className="button"
              disabled={removing}
              onClick={() => {
                setMode('view');
              }}
            >
              {t('settings.area.cancel')}
            </button>
          </div>
        </div>
      )}

      {status && (
        <p
          className={status === 'error' ? 'form__error' : 'form__success'}
          role={status === 'error' ? 'alert' : 'status'}
        >
          {t(`settings.area.${status}`)}
        </p>
      )}
    </section>
  );
}
