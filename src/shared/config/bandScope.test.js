import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseMigrateArgs } from '../../../scripts/migrate-phish-to-bandid.mjs';
import { DEFAULT_BAND_ID } from './bands.js';
import {
  BAND_SCOPED_COLLECTIONS,
  STRICT_BAND_ID_QUERIES,
  bandIdQueryConstraints,
  docBelongsToBand,
  planBandIdBackfill,
  rowsForBand,
  stampBandId,
} from './bandScope.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('stampBandId', () => {
  it('sets phish when the payload omits bandId', () => {
    const payload = stampBandId({
      userId: 'alice',
      showDate: '2026-04-23',
      picks: { s1o: 'Tweezer' },
    });
    expect(payload.bandId).toBe('phish');
    expect(payload.bandId).toBe(DEFAULT_BAND_ID);
    expect(payload.userId).toBe('alice');
    expect(payload.showDate).toBe('2026-04-23');
    expect(payload).not.toHaveProperty('id');
  });

  it('keeps an explicit bandId already on the payload', () => {
    expect(stampBandId({ name: 'Crew', bandId: 'goose' }).bandId).toBe('goose');
    expect(stampBandId({ name: 'Crew', bandId: '  phish  ' }).bandId).toBe('phish');
  });

  it('replaces a blank bandId with phish', () => {
    expect(stampBandId({ bandId: '   ' }).bandId).toBe('phish');
    expect(stampBandId({ bandId: 1 }).bandId).toBe('phish');
  });
});

describe('docBelongsToBand', () => {
  it('treats a missing bandId as the default band', () => {
    expect(docBelongsToBand({})).toBe(true);
    expect(docBelongsToBand({ showDate: '2026-04-23' })).toBe(true);
    expect(docBelongsToBand({ bandId: '' })).toBe(true);
    expect(docBelongsToBand({ bandId: 'phish' })).toBe(true);
    expect(docBelongsToBand(null)).toBe(true);
  });

  it('hides a different band without hiding legacy docs', () => {
    const rows = rowsForBand([
      { id: 'legacy' },
      { id: 'phish', bandId: 'phish' },
      { id: 'goose', bandId: 'goose' },
    ]);
    expect(rows.map((row) => row.id)).toEqual(['legacy', 'phish']);
  });
});

describe('bandId queries stay tolerant until the backfill is verified', () => {
  it('does not add a Firestore where until STRICT_BAND_ID_QUERIES is flipped', () => {
    const whereFn = (field, op, value) => ({ field, op, value });
    expect(STRICT_BAND_ID_QUERIES).toBe(false);
    expect(bandIdQueryConstraints(whereFn)).toEqual([]);
  });
});

describe('planBandIdBackfill', () => {
  it('sets phish on docs that lack the field and does not rename ids', () => {
    expect(planBandIdBackfill({ showDate: '2026-04-23' })).toEqual({
      action: 'set',
      bandId: 'phish',
    });
    expect(planBandIdBackfill({ bandId: '  ' })).toEqual({
      action: 'set',
      bandId: 'phish',
    });
  });

  it('skips docs that already have phish and does not overwrite another band', () => {
    expect(planBandIdBackfill({ bandId: 'phish' })).toEqual({
      action: 'skip-present',
      bandId: 'phish',
    });
    expect(planBandIdBackfill({ bandId: 'goose' })).toEqual({
      action: 'skip-other',
      bandId: 'goose',
    });
  });
});

describe('parseMigrateArgs', () => {
  it('is a dry-run unless --confirm is present', () => {
    expect(parseMigrateArgs([]).confirm).toBe(false);
    expect(parseMigrateArgs(['--collection=picks']).confirm).toBe(false);
    expect(parseMigrateArgs(['--confirm']).confirm).toBe(true);
  });

  it('rejects --apply so a familiar flag cannot write', () => {
    expect(() => parseMigrateArgs(['--apply'])).toThrow(/--confirm/);
  });

  it('defaults to the Phase 1 collections and rejects an unknown name', () => {
    expect(parseMigrateArgs([]).collections).toEqual([
      'picks',
      'official_setlists',
      'live_setlist_automation',
      'rollup_audit',
      'pools',
    ]);
    expect(() => parseMigrateArgs(['--collection=users'])).toThrow(/Unknown collection/);
  });
});

describe('Phase 1 collection list', () => {
  it('matches the server module and does not include a doc-id rename', () => {
    expect([...BAND_SCOPED_COLLECTIONS]).toEqual([
      'picks',
      'official_setlists',
      'live_setlist_automation',
      'rollup_audit',
      'pools',
    ]);
    const server = readFileSync(path.join(repoRoot, 'functions/bandScope.js'), 'utf8');
    expect(server).toContain('const DEFAULT_BAND_ID = "phish"');
    for (const name of BAND_SCOPED_COLLECTIONS) {
      expect(server).toContain(`"${name}"`);
    }
    const script = readFileSync(
      path.join(repoRoot, 'scripts/migrate-phish-to-bandid.mjs'),
      'utf8',
    );
    expect(script).toContain('planBandIdBackfill');
    expect(script).toContain('--confirm');
    expect(script).toContain('batch.update');
    expect(script).not.toContain('.set(');
    const writers = [
      'src/features/picks/api/picksApi.js',
      'src/features/pools/api/poolsApi.js',
      'src/features/pools/api/poolFirestore.js',
      'src/features/admin/api/officialSetlistsApi.js',
      'src/features/profile/api/profileApi.js',
      'functions/phishnetLiveSetlistAutomation.js',
      'functions/rollupCore.js',
      'functions/index.js',
      'functions/revertRollupCore.js',
      'functions/accountDelete.js',
      'functions/backfillBustoutsCore.js',
    ];
    for (const file of writers) {
      expect(readFileSync(path.join(repoRoot, file), 'utf8')).toContain('stampBandId');
    }
  });
});
