import React from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';

import {
  PoolCreateCard,
  suggestedPoolName,
  usePoolsClusterScreen,
} from '../../features/pools';

/**
 * Pools tertiary — Create Pool (`/dashboard/pools/create`).
 */
export default function PoolCreatePage({ user: userProp }) {
  const outlet = useOutletContext();
  const user = userProp ?? outlet?.user;
  const [params] = useSearchParams();
  const { actionLoading, error, onCreate } = usePoolsClusterScreen(user);

  return (
    <PoolCreateCard
      actionLoading={actionLoading}
      error={error}
      initialName={suggestedPoolName(params.get('name'))}
      onCreate={onCreate}
    />
  );
}
