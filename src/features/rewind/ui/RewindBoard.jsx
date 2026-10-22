import React from 'react';

/** Scores and handles only. Song titles stay off the board. */
export default function RewindBoard({ rows }) {
  if (!rows?.length) {
    return (
      <p className="text-sm text-content-secondary">
        No locks yet. The board fills in as players lock.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {rows.map((row) => (
        <li
          key={row.userId}
          className="flex items-baseline justify-between gap-3 rounded-xl border border-border-muted/40 bg-surface-inset px-3 py-2"
        >
          <span className="text-sm text-content-primary">
            <span className="mr-2 font-bold text-content-secondary">{row.rank}</span>
            {row.handle}
          </span>
          <span className="text-sm font-semibold text-content-primary">
            {row.score} pts
          </span>
        </li>
      ))}
    </ol>
  );
}
