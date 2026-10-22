/**
 * Rasterize a finished-tour wrap to a 1200×630 JPEG for Open Graph (#1140).
 * SVG source lives with the wrap model so the card cannot drift from the page.
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import sharp from 'sharp';

import { buildFinishedTourWrapShareSvg } from '../../src/features/tour-stats/model/finishedTourWrap.js';

/**
 * @param {NonNullable<ReturnType<import('../../src/features/tour-stats/model/finishedTourWrap.js').buildFinishedTourWrap>>} wrap
 * @param {string} outPath
 * @returns {Promise<void>}
 */
export async function writeFinishedTourWrapShareImage(wrap, outPath) {
  const svg = buildFinishedTourWrapShareSvg(wrap);
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(outPath);
}
