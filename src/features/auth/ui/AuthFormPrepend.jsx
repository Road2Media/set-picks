import React from 'react';

import { StatusBanner } from '../../../shared';
import { authFormBanner } from '../model/authFormNotice';

/**
 * Context (pool invite, create-account consent) plus the one action notice.
 * The notice slot renders at most one banner, above Continue with Google.
 */
export default function AuthFormPrepend({ poolMessage, notice, children }) {
  const banner = authFormBanner(notice);
  if (!poolMessage && !banner && !children) return null;

  return (
    <div className={children ? 'space-y-4' : 'space-y-3'}>
      {poolMessage ? (
        <StatusBanner type="info" message={poolMessage} className="text-left" />
      ) : null}
      {children}
      {banner ? (
        <StatusBanner type={banner.type} message={banner.message} className="text-left" />
      ) : null}
    </div>
  );
}
