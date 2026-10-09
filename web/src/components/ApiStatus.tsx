import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchHealth } from '../api/health';

type Status = 'checking' | 'ok' | 'unavailable';

export function ApiStatus() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal).then(
      () => {
        setStatus('ok');
      },
      () => {
        if (!controller.signal.aborted) setStatus('unavailable');
      },
    );
    return () => {
      controller.abort();
    };
  }, []);

  // "ok" is the literal value returned by the API, so it is not translated.
  const label = status === 'ok' ? 'ok' : t(`apiStatus.${status}`);

  return (
    <p className={`api-status api-status--${status}`} role="status">
      {t('apiStatus.label', { status: label })}
    </p>
  );
}
