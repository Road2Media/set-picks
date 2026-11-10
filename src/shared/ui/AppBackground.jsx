import React from 'react';

/**
 * Fixed “stage light” ambient layer (design.md §1–2). Domain-agnostic; compose from app shell.
 * Uses semantic brand / venue tokens only — no routing or data.
 */
export default function AppBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute top-[-20%] left-1/2 h-[min(100vw,56rem)] w-[min(100vw,56rem)] -translate-x-1/2 rounded-full bg-brand-primary/12 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-15%] h-[min(70vh,32rem)] w-[min(85vw,28rem)] rounded-full bg-brand-accent-blue/12 blur-[100px]" />
      <div className="absolute top-[28%] left-[-20%] h-[min(75vh,36rem)] w-[min(70vw,30rem)] rounded-full bg-brand-bg-deep/90 blur-[90px]" />
    </div>
  );
}
