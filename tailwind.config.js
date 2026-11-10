/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}", 
  ],
  /**
   * v4 does not support `safelist`. Display sizes (`text-display-*`) are
   * emitted when the class string appears in a scanned source file.
   * A dynamic class needs `@source inline()` in `src/index.css`.
   */
  theme: {
    extend: {
      /**
       * Semantic design tokens (Target 0: design system foundation).
       * Derived from Button.jsx, SplashHeroSection, and dashboard containers (Standings, Admin, forms).
       *
       * `desk`, `mob`, and `short` are `@custom-variant`s in `src/index.css`,
       * not `theme.screens`. v4 breakpoints are min-width only (#705, #761).
       */
      colors: {
        brand: {
          /** Venue base — Tailwind `indigo-950` (The Kuroda) */
          bg: 'rgb(var(--brand-bg) / <alpha-value>)',
          'bg-deep': 'rgb(var(--brand-bg-deep) / <alpha-value>)',
          primary: 'rgb(var(--brand-primary) / <alpha-value>)',
          'primary-strong': 'rgb(var(--brand-primary-strong) / <alpha-value>)',
          kicker: 'rgb(var(--brand-primary) / <alpha-value>)',
          accent: {
            red: '#ef4444',
            blue: '#3b82f6',
          },
        },
        surface: {
          /*
           * Opaque channels. v4 applies `/40` with color-mix against the whole
           * color, so a baked alpha (the v3 `rgb(... / 0.5)` form) would stack
           * and wash the panel out. Default alphas live on the utilities
           * (`bg-surface-panel/50`, and so on).
           */
          glass: 'rgb(var(--surface-glass) / <alpha-value>)',
          chrome: 'rgb(var(--surface-chrome) / <alpha-value>)',
          /** ~design.md panel translucency — bare utilities use `/50` */
          panel: 'rgb(var(--surface-panel) / <alpha-value>)',
          'panel-strong': 'rgb(var(--surface-panel-strong) / <alpha-value>)',
          inset: 'rgb(var(--surface-inset) / <alpha-value>)',
          field: 'rgb(var(--surface-field) / <alpha-value>)',
        },
        /** Secondary UI copy — labels, helper text, meta (dashboard + shared forms) */
        content: {
          secondary: 'rgb(var(--content-secondary) / <alpha-value>)',
        },
        border: {
          glass: 'rgb(var(--border-glass) / <alpha-value>)',
          subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
          muted: 'rgb(var(--border-muted) / <alpha-value>)',
          /** Kuroda accents — keep one family (teal) for interactive affordances */
          venue: 'rgb(var(--border-venue) / <alpha-value>)',
          'venue-strong': 'rgb(var(--border-venue-strong) / <alpha-value>)',
        },
      },
      boxShadow: {
        'glow-brand': '0 0 40px -10px rgba(45, 212, 191, 0.5)',
        'glow-brand-lg': '0 0 60px -15px rgba(45, 212, 191, 0.7)',
        'glow-kicker': '0 0 12px rgba(45, 212, 191, 0.5)',
        'inset-glass': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
      },
      ringColor: {
        brand: '#2dd4bf',
      },
      fontFamily: {
        // Inter becomes the default font for the whole app
        sans: ['Inter', 'sans-serif'],
        // Space Grotesk becomes available via the 'font-display' class
        display: ['"Space Grotesk"', 'sans-serif'],
      },
      keyframes: {
        pageEnter: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'page-enter': 'pageEnter 0.32s ease-out forwards',
      },
      fontSize: {
        body: ['0.875rem', { lineHeight: '1.5' }],
        title: ['1.5rem', { lineHeight: '1.2', fontWeight: '800' }],
        /** Space Grotesk ladder — optically bumped vs Inter so headings clear body / font-black UI */
        'display-hero': ['3.25rem', { lineHeight: '1.05', letterSpacing: '-0.025em' }],
        'display-hero-lg': ['4.5rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        'display-xl': ['2rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-xl-lg': ['2.375rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-lg': ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        'display-lg-lg': ['2.125rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        'display-md': ['1.5rem', { lineHeight: '1.22', letterSpacing: '-0.02em' }],
        'display-md-lg': ['1.75rem', { lineHeight: '1.22', letterSpacing: '-0.02em' }],
        /** Dashboard page titles (main h2 per screen) */
        'display-page': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        'display-page-lg': ['2.375rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        'display-sm': ['1.3125rem', { lineHeight: '1.28', letterSpacing: '-0.015em' }],
        /** Product wordmark — larger than nav/UI; use with font-display + font-bold */
        'display-brand-sidebar': ['1.875rem', { lineHeight: '1.12', letterSpacing: '-0.022em' }],
        'display-brand-sidebar-lg': ['2.125rem', { lineHeight: '1.12', letterSpacing: '-0.022em' }],
        'display-brand-bar': ['1.5625rem', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        /** Splash hero only — above display-hero so title clearly leads body copy */
        'display-hero-splash': ['3.75rem', { lineHeight: '1.04', letterSpacing: '-0.028em' }],
        'display-hero-splash-lg': ['5rem', { lineHeight: '1.03', letterSpacing: '-0.032em' }],
      },
    },
  },
  plugins: [],
}