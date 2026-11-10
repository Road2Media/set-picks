/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}", 
  ],
  /**
   * Extended `fontSize` tokens (`text-display-*`) were present on nodes but computed as 16px in dev
   * (inherits preflight `h*` reset) — rules were missing from the served stylesheet. Safelist guarantees
   * emission so display typography always has matching CSS in Vite dev + production.
   */
  safelist: [
    {
      pattern: /^text-display-[-\w]+$/,
      variants: ['responsive'],
    },
  ],
  theme: {
    extend: {
      /**
       * Device chrome vs width reflow (#705). Stock `sm`/`md`/`lg` stay the
       * reflow vocabulary. `desk` and `mob` are complements (the 0.02px seam
       * keeps them from both matching). `short` compacts the mobile header
       * and does not overlap `desk` (min-height 480px).
       */
      screens: {
        desk: { raw: '(min-width: 768px) and (min-height: 480px)' },
        mob: { raw: '(max-width: 767.98px), (max-height: 479.98px)' },
        short: { raw: '(max-height: 479.98px)' },
      },
      /**
       * Semantic design tokens (Target 0: design system foundation).
       * Derived from Button.jsx, SplashHeroSection, and dashboard containers (Standings, Admin, forms).
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
          glass: 'rgb(var(--surface-glass) / 0.32)',
          chrome: 'rgb(var(--surface-chrome) / 0.5)',
          /** ~design.md panel translucency */
          panel: 'rgb(var(--surface-panel) / 0.5)',
          'panel-strong': 'rgb(var(--surface-panel-strong) / 0.72)',
          inset: 'rgb(var(--surface-inset) / 0.72)',
          field: 'rgb(var(--surface-field) / 1)',
        },
        /** Secondary UI copy — labels, helper text, meta (dashboard + shared forms) */
        content: {
          secondary: 'rgb(var(--content-secondary) / <alpha-value>)',
        },
        border: {
          glass: 'rgb(var(--border-glass) / 0.25)',
          subtle: 'rgb(var(--border-subtle) / 0.5)',
          muted: 'rgb(var(--border-muted) / 0.6)',
          /** Kuroda accents — keep one family (teal) for interactive affordances */
          venue: 'rgb(var(--border-venue) / 0.34)',
          'venue-strong': 'rgb(var(--border-venue-strong) / 0.46)',
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