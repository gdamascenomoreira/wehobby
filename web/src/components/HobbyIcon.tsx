import type { ReactElement } from 'react';

const PATHS: Record<string, ReactElement> = {
  // A ball of yarn with a hook.
  crochet: (
    <>
      <circle cx="11" cy="13" r="7" />
      <path d="M5.5 9.5c3 1 7.5 1 11 0M4.5 14c3.5 1.5 9 1.5 13 0M8 19c1-4 1-9-1-13" />
      <path d="M16 8l5-5" />
    </>
  ),
  // A leaf on a stem.
  plants: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13c0-5 3-8 8-9 0 5-3 9-8 9z" />
      <path d="M12 15c0-3-2-5-6-6 0 3 2 6 6 6z" />
    </>
  ),
  // A camera.
  photography: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
};

/** A simple line icon for a hobby. Decorative: the hobby name is always shown next to it. */
export function HobbyIcon({ hobbyId }: { hobbyId: string }) {
  return (
    <svg
      className="hobby-icon"
      viewBox="0 0 24 24"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[hobbyId] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}
