import { useId, type ReactElement } from 'react';

interface FieldProps {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  /** Shown when there is no error, for example "username available". */
  success?: string | undefined;
  /** Renders the control with the ids it needs for its label and messages. */
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  }) => ReactElement;
}

/** A labelled form control with an optional hint and an error announced to screen readers. */
export function Field({ label, hint, error, success, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const messageId = `${id}-message`;
  const message = error ?? success;
  const describedBy = [hint && hintId, message && messageId].filter(Boolean).join(' ');

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        'aria-invalid': error !== undefined,
        'aria-describedby': describedBy || undefined,
      })}
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {message && (
        <p
          id={messageId}
          className={error ? 'field__error' : 'field__success'}
          role={error ? 'alert' : 'status'}
        >
          {message}
        </p>
      )}
    </div>
  );
}
