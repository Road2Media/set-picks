import React from 'react';

import {
  dashboardPageTitleGradientClasses,
  dashboardPageTitleWarRoomClasses,
} from '../../../shared/config/dashboardHeadingTypography';

export default function DashboardPageHeading({ title, tone = 'default' }) {
  const isWarRoom = tone === 'warRoom';

  return (
    <h2
      className={`hidden desk:block font-display text-display-page md:text-display-page-lg font-bold mb-6 mt-1 tracking-tight ${
        isWarRoom ? dashboardPageTitleWarRoomClasses : dashboardPageTitleGradientClasses
      }`}
    >
      {title}
    </h2>
  );
}

