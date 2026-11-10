import React, { useId } from 'react';
import logoUrl from '../../assets/brand/logo.webp';

interface LogoProps {
  /** Largura em px; a altura acompanha a proporção da arte. */
  width?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** Logo completa (globo + letreiro). Use em áreas de marca: login, bloqueio, splash. */
export const Logo: React.FC<LogoProps> = ({ width = 180, className, style }) => (
  <img
    src={logoUrl}
    alt="RiskZero"
    width={width}
    height={Math.round(width * 0.795)}
    className={className}
    style={{ display: 'block', height: 'auto', ...style }}
    draggable={false}
    decoding="async"
  />
);

interface MarkProps {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Símbolo vetorial da marca (globo com meridianos + órbita + brilho),
 * desenhado para tamanhos pequenos onde o letreiro da logo não é legível.
 */
export const RzMark: React.FC<MarkProps> = ({ size = 32, className, title }) => {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={`g${id}`} x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8CC8FF" />
          <stop offset="1" stopColor="#2F7BFF" />
        </linearGradient>
        <linearGradient id={`o${id}`} x1="2" y1="30" x2="46" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2F7BFF" stopOpacity="0.2" />
          <stop offset="0.55" stopColor="#B9E0FF" />
          <stop offset="1" stopColor="#2F7BFF" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <g stroke={`url(#g${id})`} strokeWidth="2.2">
        <circle cx="24" cy="24" r="16" />
        <ellipse cx="24" cy="24" rx="7" ry="16" />
        <path d="M24 8v32M8 24h32" />
        <path d="M10.5 15.5c8.5 2.6 18.5 2.6 27 0M10.5 32.5c8.5-2.6 18.5-2.6 27 0" />
      </g>
      <ellipse
        cx="24"
        cy="24"
        rx="22"
        ry="7.5"
        transform="rotate(-16 24 24)"
        stroke={`url(#o${id})`}
        strokeWidth="2.4"
      />
      <path d="M40 6.5l1.1 2.9 2.9 1.1-2.9 1.1L40 14.5l-1.1-2.9-2.9-1.1 2.9-1.1z" fill="#EAF6FF" />
    </svg>
  );
};

export default Logo;

