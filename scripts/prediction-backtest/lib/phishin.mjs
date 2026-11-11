/**
 * Phish.in v2 → setlist rows for the #648 ShowRecord cache (#1002).
 *
 * Used when PHISHNET_API_KEY is not available. The backtest still scores
 * the same ShowRecord shape the Phish.net importer writes.
 */

const PHISHIN_ORIGIN = "https://phish.in/api/v2";

/**
 * Map a Phish.in set_name onto the setKey buildSetlistDocFromRows expects.
 * Soundcheck and unknown labels are dropped (return null).
 * @param {unknown} setName
 * @returns {string | null}
 */
export function phishinSetKey(setName) {
  const raw = String(setName ?? "").trim().toLowerCase();
  if (!raw || raw.includes("soundcheck")) return null;
  if (raw === "e" || raw === "encore" || raw.startsWith("encore")) return "encore";
  const numbered = /^set\s*(\d+)$/.exec(raw);
  if (numbered) return numbered[1];
  if (/^\d+$/.test(raw)) return raw;
  return null;
}

/**
 * @param {unknown[]} tracks
 * @returns {{ setKey: string, position: number, title: string, gap: null }[]}
 */
export function rowsFromPhishinTracks(tracks) {
  /** @type {{ setKey: string, position: number, title: string, gap: null }[]} */
  const rows = [];
  const list = Array.isArray(tracks) ? tracks : [];
  for (const track of list) {
    if (!track || typeof track !== "object") continue;
    if (track.exclude_from_stats === true) continue;
    const setKey = phishinSetKey(track.set_name ?? track.set);
    const title = typeof track.title === "string" ? track.title.trim() : "";
    if (!setKey || !title) continue;
    const position = Number(track.position);
    rows.push({
      setKey,
      position: Number.isFinite(position) ? position : rows.length + 1,
      title,
      gap: null,
    });
  }
  return rows;
}

/**
 * @param {number} year
 */
export function phishinYearUrl(year) {
  return `${PHISHIN_ORIGIN}/shows?year=${year}&per_page=300`;
}

/**
 * @param {string} showDate
 */
export function phishinShowUrl(showDate) {
  return `${PHISHIN_ORIGIN}/shows/${encodeURIComponent(showDate)}`;
}

/**
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch, retries?: number }} [opts]
 */
export async function fetchPhishinJson(url, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const retries = opts.retries ?? 3;
  let lastError = new Error(`Phish.in fetch failed: ${url}`);
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const res = await fetchImpl(url, {
      headers: {
        accept: "application/json",
        "user-agent": "set-picks-backtest",
      },
    });
    if (res.ok) return res.json();
    lastError = new Error(`Phish.in ${res.status} for ${url}`);
    if (res.status !== 429 && res.status < 500) throw lastError;
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  throw lastError;
}
