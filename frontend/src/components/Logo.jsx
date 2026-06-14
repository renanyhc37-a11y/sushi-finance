import React from 'react';

// SushiControl — ninja com hachimaki. Tom dourado/amarelado.
export default function Logo({ size = 44 }) {
  const uid = React.useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1a1a1a" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
        <linearGradient id={`band${uid}`} x1="0" y1="0" x2="44" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#d97706" />
          <stop offset="50%"  stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <linearGradient id={`eye${uid}`} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <radialGradient id={`eyeGlow${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
        <filter id={`glow${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <clipPath id={`clip${uid}`}>
          <circle cx="22" cy="22" r="20" />
        </clipPath>
      </defs>

      {/* Fundo circular */}
      <circle cx="22" cy="22" r="21" fill={`url(#bg${uid})`} />
      <circle cx="22" cy="22" r="20" fill="none" stroke="#fbbf24" strokeWidth="0.8" opacity="0.55" />

      <g clipPath={`url(#clip${uid})`}>

        {/* Cabeça do ninja — silhueta */}
        <ellipse cx="22" cy="20" rx="13" ry="14" fill="#1e1e1e" />

        {/* Topo da cabeça */}
        <ellipse cx="22" cy="11" rx="11" ry="7" fill="#111" />

        {/* Faixa / hachimaki — headband dourada */}
        <rect x="9" y="15.5" width="26" height="5.5" rx="1" fill={`url(#band${uid})`} />

        {/* Nó da faixa — lado direito */}
        <ellipse cx="36" cy="18.2" rx="4.5" ry="3" fill="#d97706" />
        <ellipse cx="36" cy="18.2" rx="3" ry="1.8" fill="#f59e0b" />
        {/* Cauda da faixa */}
        <path d="M38 17 Q42 14 41 19 Q43 22 38 21Z" fill="#b45309" opacity="0.85" />

        {/* Máscara do ninja */}
        <rect x="9" y="21" width="26" height="16" rx="2" fill="#161616" />
        <line x1="12" y1="24" x2="32" y2="24" stroke="#2a2a2a" strokeWidth="0.8" />
        <line x1="12" y1="27" x2="32" y2="27" stroke="#2a2a2a" strokeWidth="0.8" />
        <line x1="12" y1="30" x2="32" y2="30" stroke="#2a2a2a" strokeWidth="0.8" />

        {/* Glow dos olhos */}
        <ellipse cx="16" cy="22.5" rx="4" ry="2" fill={`url(#eyeGlow${uid})`} />
        <ellipse cx="28" cy="22.5" rx="4" ry="2" fill={`url(#eyeGlow${uid})`} />

        {/* Olhos — amêndoa ninja */}
        <path d="M12.5 22.5 Q16 19.5 19.5 22.5 Q16 24.5 12.5 22.5Z"
          fill={`url(#eye${uid})`} filter={`url(#glow${uid})`} />
        <path d="M24.5 22.5 Q28 19.5 31.5 22.5 Q28 24.5 24.5 22.5Z"
          fill={`url(#eye${uid})`} filter={`url(#glow${uid})`} />

        {/* Pupila */}
        <ellipse cx="16" cy="22.5" rx="1.8" ry="1.4" fill="#92400e" />
        <ellipse cx="28" cy="22.5" rx="1.8" ry="1.4" fill="#92400e" />

        {/* Brilho dos olhos */}
        <circle cx="14.8" cy="21.6" r="0.7" fill="white" opacity="0.7" />
        <circle cx="26.8" cy="21.6" r="0.7" fill="white" opacity="0.7" />

      </g>
    </svg>
  );
}
