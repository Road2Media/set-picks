import React from 'react';

import {
  SONG_PLAY_COUNT_FOOTNOTE,
  SONG_PLAY_COUNT_MARKER,
  SONG_PLAY_COUNT_NOTE_ID,
} from '../model/songNightCount';

/** Superscript marker, only when total times played exceed nights. */
export function SongPlayCountMarker({ className = '' }) {
  return (
    <a
      href={`#${SONG_PLAY_COUNT_NOTE_ID}`}
      data-song-play-note="marker"
      className={`ml-px align-super text-[0.65em] font-bold leading-none text-teal-300 no-underline ${className}`}
      aria-label="Note on total times played"
    >
      {SONG_PLAY_COUNT_MARKER}
    </a>
  );
}

/** Footnote for a tour stats view that shows the marker. */
export function SongPlayCountNote({ className = '' }) {
  return (
    <p
      id={SONG_PLAY_COUNT_NOTE_ID}
      data-song-play-note="footnote"
      className={className}
    >
      <span aria-hidden="true">{SONG_PLAY_COUNT_MARKER} </span>
      {SONG_PLAY_COUNT_FOOTNOTE}
    </p>
  );
}
