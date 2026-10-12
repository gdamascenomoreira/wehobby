import { useTranslation } from 'react-i18next';

/**
 * Names of hobbies and hobby types. Their ids come from the API, so the i18n
 * keys cannot be checked at compile time; an id without a translation shows
 * as the id itself.
 */
export function useHobbyNames() {
  const { t } = useTranslation();
  const translate = (key: string, fallback: string): string =>
    // `never`: the key is built at runtime (see above).
    t(key as never, { defaultValue: fallback });

  return {
    hobby: (hobbyId: string) => translate(`hobbies.names.${hobbyId}`, hobbyId),
    type: (hobbyId: string, typeId: string) =>
      translate(`hobbies.types.${hobbyId}.${typeId}`, typeId),
  };
}
