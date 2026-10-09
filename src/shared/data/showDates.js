// src/shared/data/showDates.js
// Emergency fallback when Firestore `show_calendar/snapshot` is missing or invalid (issue #160).

/** Grouped for UI (e.g. optgroups). Order of tours is preserved. */
export const FALLBACK_SHOW_DATES_BY_TOUR = [
  {
    tour: 'Past Shows',
    shows: [
      { date: '2026-01-28', venue: 'Moon Palace, Cancun, MX' },
      { date: '2026-01-29', venue: 'Moon Palace, Cancun, MX' },
      { date: '2026-01-30', venue: 'Moon Palace, Cancun, MX' },
      { date: '2026-01-31', venue: 'Moon Palace, Cancun, MX' },
    ],
  },
  {
    tour: 'Sphere Run',
    shows: [
      { date: '2026-04-16', venue: 'Sphere, Las Vegas, NV' },
      { date: '2026-04-17', venue: 'Sphere, Las Vegas, NV' },
      { date: '2026-04-18', venue: 'Sphere, Las Vegas, NV' },
      { date: '2026-04-23', venue: 'Sphere, Las Vegas, NV' },
      { date: '2026-04-24', venue: 'Sphere, Las Vegas, NV' },
      { date: '2026-04-25', venue: 'Sphere, Las Vegas, NV' },
      { date: '2026-04-30', venue: 'Sphere, Las Vegas, NV' },
      { date: '2026-05-01', venue: 'Sphere, Las Vegas, NV' },
      { date: '2026-05-02', venue: 'Sphere, Las Vegas, NV' },
    ],
  },
  {
    tour: 'Summer Tour',
    shows: [
      { date: '2026-07-07', venue: 'Kohl Center, Madison, WI' },
      { date: '2026-07-08', venue: 'Kohl Center, Madison, WI' },
      { date: '2026-07-10', venue: 'Ruoff Music Center, Noblesville, IN' },
      { date: '2026-07-11', venue: 'Ruoff Music Center, Noblesville, IN' },
      { date: '2026-07-12', venue: 'Ruoff Music Center, Noblesville, IN' },
      { date: '2026-07-14', venue: 'Enmarket Arena, Savannah, GA' },
      { date: '2026-07-15', venue: 'Enmarket Arena, Savannah, GA' },
      { date: '2026-07-17', venue: 'Coastal Credit Union Music Park at Walnut Creek, Raleigh, NC' },
      { date: '2026-07-18', venue: 'Merriweather Post Pavilion, Columbia, MD' },
      { date: '2026-07-19', venue: 'Merriweather Post Pavilion, Columbia, MD' },
      { date: '2026-07-21', venue: 'Empower Federal Credit Union Amphitheater at Lakeview, Syracuse, NY' },
      { date: '2026-07-22', venue: 'Madison Square Garden, New York, NY' },
      { date: '2026-07-24', venue: 'Madison Square Garden, New York, NY' },
      { date: '2026-07-25', venue: 'Madison Square Garden, New York, NY' },
      { date: '2026-07-27', venue: 'Madison Square Garden, New York, NY' },
      { date: '2026-07-29', venue: 'Madison Square Garden, New York, NY' },
      { date: '2026-07-31', venue: 'Fenway Park, Boston, MA' },
      { date: '2026-08-01', venue: 'Fenway Park, Boston, MA' },
      { date: '2026-09-04', venue: "Dick's Sporting Goods Park, Commerce City, CO" },
      { date: '2026-09-05', venue: "Dick's Sporting Goods Park, Commerce City, CO" },
      { date: '2026-09-06', venue: "Dick's Sporting Goods Park, Commerce City, CO" },
    ],
  },
  {
    tour: 'Fall Tour',
    shows: [
      { date: '2026-10-02', venue: 'Jim Whelan Boardwalk Hall, Atlantic City, NJ' },
      { date: '2026-10-03', venue: 'Jim Whelan Boardwalk Hall, Atlantic City, NJ' },
      { date: '2026-10-04', venue: 'Jim Whelan Boardwalk Hall, Atlantic City, NJ' },
      { date: '2026-10-06', venue: 'Allianz Amphitheater at Riverfront, Richmond, VA' },
      { date: '2026-10-07', venue: 'Allianz Amphitheater at Riverfront, Richmond, VA' },
      { date: '2026-10-09', venue: 'VyStar Veterans Memorial Arena, Jacksonville, FL' },
      { date: '2026-10-11', venue: 'The Orion Amphitheater, Huntsville, AL' },
      { date: '2026-10-12', venue: 'The Orion Amphitheater, Huntsville, AL' },
    ],
  },
];

/** Flat list (chronological) for logic that only needs dates — e.g. next show. */
export const FALLBACK_SHOW_DATES =
  FALLBACK_SHOW_DATES_BY_TOUR.flatMap((g) => g.shows);

/** @deprecated Use calendar from `features/show-calendar` (Phish.net sync). Kept for tests / tooling. */
export const SHOW_DATES_BY_TOUR = FALLBACK_SHOW_DATES_BY_TOUR;

/** @deprecated Use calendar from `features/show-calendar`. */
export const SHOW_DATES = FALLBACK_SHOW_DATES;
