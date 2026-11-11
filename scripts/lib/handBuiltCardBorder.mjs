/**
 * Hand-built card border (#1090).
 *
 * A string under src/features or src/pages that draws its own rounded box
 * (rounded-xl / 2xl / 3xl) with a border and a surface fill, instead of
 * Card, Panel, or Row. Buttons and chips usually miss the surface fill,
 * so they are not this check.
 *
 * Comments are skipped, so an apostrophe in prose (`user's`) does not
 * swallow the next template literal. Strings nested in `${...}` are visited.
 *
 * Existing hits are grandfathered in
 * scripts/dashboard-ui-card-border-baseline.json. A higher count fails.
 */

const ROUNDED_RE = /\brounded-(?:xl|2xl|3xl)\b/;
const BORDER_RE = /\bborder\b/;
const SURFACE_RE =
  /\bbg-surface\b|\bbg-white\b|\bbg-\[rgb\(var\(--surface|\bshadow-inset-glass\b/;

export function isHandBuiltCardBorder(text) {
  return ROUNDED_RE.test(text) && BORDER_RE.test(text) && SURFACE_RE.test(text);
}

/**
 * @param {string} source
 * @returns {{ line: number, text: string }[]}
 */
export function handBuiltCardBorderHits(source) {
  const hits = [];
  scanStrings(source, 0, source.length, hits);
  return hits;
}

function pushHit(source, index, body, hits) {
  if (!isHandBuiltCardBorder(body)) return;
  const line = source.slice(0, index).split('\n').length;
  hits.push({ line, text: body.replace(/\s+/g, ' ').trim().slice(0, 180) });
}

function scanStrings(source, start, end, hits) {
  let i = start;
  while (i < end) {
    if (source[i] === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i);
      i = nl === -1 || nl >= end ? end : nl + 1;
      continue;
    }
    if (source[i] === '/' && source[i + 1] === '*') {
      const close = source.indexOf('*/', i + 2);
      i = close === -1 || close >= end ? end : close + 2;
      continue;
    }

    const quote = source[i];
    if (quote !== '"' && quote !== "'" && quote !== '`') {
      i += 1;
      continue;
    }

    const open = i;
    let j = i + 1;
    let body = '';
    while (j < end) {
      const ch = source[j];
      if (ch === '\\') {
        body += source[j + 1] ?? '';
        j += 2;
        continue;
      }
      if (quote === '`' && ch === '$' && source[j + 1] === '{') {
        body += ' ';
        const inner = j + 2;
        const close = skipBraces(source, inner, end);
        scanStrings(source, inner, close, hits);
        j = close + 1;
        continue;
      }
      if (ch === quote) break;
      body += ch;
      j += 1;
    }
    pushHit(source, open, body, hits);
    i = j + 1;
  }
}

/** Index of the `}` that closes a `{` whose contents start at `open`. */
function skipBraces(source, open, end) {
  let depth = 1;
  let i = open;
  while (i < end && depth > 0) {
    if (source[i] === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i);
      i = nl === -1 || nl >= end ? end : nl + 1;
      continue;
    }
    if (source[i] === '/' && source[i + 1] === '*') {
      const close = source.indexOf('*/', i + 2);
      i = close === -1 || close >= end ? end : close + 2;
      continue;
    }
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipQuoted(source, i, end) + 1;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    if (depth === 0) return i;
    i += 1;
  }
  return end;
}

function skipQuoted(source, open, end) {
  const quote = source[open];
  let i = open + 1;
  while (i < end) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (quote === '`' && source[i] === '$' && source[i + 1] === '{') {
      const close = skipBraces(source, i + 2, end);
      i = close + 1;
      continue;
    }
    if (source[i] === quote) return i;
    i += 1;
  }
  return end;
}
