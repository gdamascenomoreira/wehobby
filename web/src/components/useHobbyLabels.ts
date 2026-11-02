import { useTranslation } from 'react-i18next';

/** A readable fallback for an id the app has no translation for yet, e.g. `home_decor`. */
function humanize(id: string): string {
  const words = id.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Names of hobbies and types, from `hobbies.<id>.name` and
 * `hobbies.<id>.types.<typeId>`. A type the platform adds before the web app
 * knows its name still shows, using its id.
 */
export function useHobbyLabels() {
  const { t, i18n } = useTranslation();
  // The ids come from the API, so these keys cannot be checked at compile time.
  const translate = (key: string, fallback: string): string =>
    i18n.exists(key) ? (t as unknown as (key: string) => string)(key) : fallback;

  return {
    hobbyName: (hobbyId: string) => translate(`hobbies.${hobbyId}.name`, humanize(hobbyId)),
    typeName: (hobbyId: string, typeId: string) =>
      translate(`hobbies.${hobbyId}.types.${typeId}`, humanize(typeId)),
  };
}
