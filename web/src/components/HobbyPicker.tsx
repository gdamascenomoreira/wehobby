import type { Hobby, MyHobby } from '@wehobby/shared';
import { useTranslation } from 'react-i18next';
import { HobbyIcon } from './HobbyIcon';
import { useHobbyLabels } from './useHobbyLabels';

interface HobbyPickerProps {
  catalog: Hobby[];
  value: MyHobby[];
  onChange: (next: MyHobby[]) => void;
  /** Shown under the hobbies, for example "Pick at least one hobby." */
  error?: string | undefined;
}

/**
 * Hobbies as large cards, then the types of each picked hobby as chips. Every
 * card and chip is a real checkbox with a label, so it works with a keyboard
 * and a screen reader. Used by onboarding and Settings.
 */
export function HobbyPicker({ catalog, value, onChange, error }: HobbyPickerProps) {
  const { t } = useTranslation();
  const { hobbyName, typeName } = useHobbyLabels();
  const picked = new Map(value.map((hobby) => [hobby.hobbyId, hobby.typeIds]));

  function toggleHobby(hobbyId: string) {
    onChange(
      picked.has(hobbyId)
        ? value.filter((hobby) => hobby.hobbyId !== hobbyId)
        : [...value, { hobbyId, typeIds: [] }],
    );
  }

  function toggleType(hobbyId: string, typeId: string) {
    onChange(
      value.map((hobby) =>
        hobby.hobbyId !== hobbyId
          ? hobby
          : {
              hobbyId,
              typeIds: hobby.typeIds.includes(typeId)
                ? hobby.typeIds.filter((id) => id !== typeId)
                : [...hobby.typeIds, typeId],
            },
      ),
    );
  }

  return (
    <div className="hobby-picker">
      <fieldset
        className="hobby-picker__group"
        aria-describedby={error ? 'hobby-picker-error' : undefined}
      >
        <legend>{t('hobbyPicker.hobbies')}</legend>
        <div className="hobby-cards">
          {catalog.map((hobby) => (
            <label key={hobby.id} className="hobby-card">
              <input
                type="checkbox"
                className="hobby-card__input"
                checked={picked.has(hobby.id)}
                onChange={() => {
                  toggleHobby(hobby.id);
                }}
              />
              <HobbyIcon hobbyId={hobby.id} />
              <span className="hobby-card__name">{hobbyName(hobby.id)}</span>
            </label>
          ))}
        </div>
        {error && (
          <p id="hobby-picker-error" className="field__error" role="alert">
            {error}
          </p>
        )}
      </fieldset>

      {catalog
        .filter((hobby) => picked.has(hobby.id) && hobby.types.length > 0)
        .map((hobby) => (
          <fieldset key={hobby.id} className="hobby-picker__group">
            <legend>{t('hobbyPicker.types', { hobby: hobbyName(hobby.id) })}</legend>
            <p className="field__hint">{t('hobbyPicker.typesHint')}</p>
            <div className="chips">
              {hobby.types.map((type) => (
                <label key={type.id} className="chip">
                  <input
                    type="checkbox"
                    className="chip__input"
                    checked={picked.get(hobby.id)?.includes(type.id) ?? false}
                    onChange={() => {
                      toggleType(hobby.id, type.id);
                    }}
                  />
                  <span>{typeName(hobby.id, type.id)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
    </div>
  );
}
