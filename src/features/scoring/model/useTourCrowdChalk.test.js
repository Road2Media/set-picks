import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

import { tourCrowdChalkQueryKey } from './useTourCrowdChalk';

function createIsolatedClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 0,
      },
    },
  });
}

describe('tourCrowdChalkQueryKey', () => {
  it('shares one fetch for the same locked nights and ignores the open night', async () => {
    const client = createIsolatedClient();
    const load = vi.fn(async () => ({ nightsCounted: 2, songs: [] }));
    const prior = ['2026-07-17', '2026-07-18'];

    await client.fetchQuery({
      queryKey: tourCrowdChalkQueryKey(prior),
      queryFn: load,
    });
    await client.fetchQuery({
      queryKey: tourCrowdChalkQueryKey(prior),
      queryFn: load,
    });

    expect(load).toHaveBeenCalledTimes(1);
    expect(tourCrowdChalkQueryKey(prior)).not.toEqual(
      tourCrowdChalkQueryKey([...prior, '2026-12-30'])
    );
  });
});
