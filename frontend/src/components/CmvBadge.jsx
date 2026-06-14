import React from 'react';

export default function CmvBadge({ cmv }) {
  if (cmv == null) return null;
  if (cmv <= 30) return <span className="badge-green">CMV {cmv.toFixed(1)}%</span>;
  if (cmv <= 35) return <span className="badge-yellow">CMV {cmv.toFixed(1)}%</span>;
  return <span className="badge-red">CMV {cmv.toFixed(1)}%</span>;
}
