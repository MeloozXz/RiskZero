import React from 'react';

export type OrbitTone = 'accent' | 'success' | 'warning' | 'danger' | 'violet' | 'muted';

const TONE_COLOR: Record<OrbitTone, string> = {
  accent: '#2F7BFF',
  success: '#2BD9A0',
  warning: '#FFB547',
  danger: '#FF5470',
  violet: '#7B5CF0',
  muted: '#6A7FA3',
};

interface OrbitRingProps {
  /** 0–100. Omita (ou use `spinning`) para estado indeterminado. */
  value?: number;
  size?: number;
  stroke?: number;
  tone?: OrbitTone;
  /** Anima um satélite em órbita — para estados "vivos" (conectando, analisando). */
  spinning?: boolean;
  /** Mostra meridianos internos (referência ao globo da logo). */
  globe?: boolean;
  children?: React.ReactNode;
  className?: string;
  label?: string;
}

/**
 * Indicador circular da identidade Orbital: trilho + arco de progresso
 * com satélite na ponta. Serve para score, progresso e carregamento.
 */
export const OrbitRing: React.FC<OrbitRingProps> = ({
  value,
  size = 120,
  stroke = 6,
  tone = 'accent',
  spinning = false,
  globe = true,
  children,
  className,
  label,
}) => {
  const color = TONE_COLOR[tone];
  const r = (size - stroke) / 2 - 4;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const indeterminate = spinning || value === undefined;
  const pct = indeterminate ? 28 : Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * circumference;
  const angle = (pct / 100) * 2 * Math.PI - Math.PI / 2;
  const satX = c + r * Math.cos(angle);
  const satY = c + r * Math.sin(angle);

  return (
    <div
      className={className}
      role={indeterminate ? 'status' : 'meter'}
      aria-label={label}
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden>
        {globe && (
          <g stroke="#2F7BFF" strokeOpacity="0.16" strokeWidth="1">
            <ellipse cx={c} cy={c} rx={r * 0.42} ry={r - stroke} />
            <line x1={c} y1={c - r + stroke} x2={c} y2={c + r - stroke} />
            <line x1={c - r + stroke} y1={c} x2={c + r - stroke} y2={c} />
          </g>
        )}
        <circle cx={c} cy={c} r={r} stroke="#1A2D52" strokeWidth={stroke} />
        <g
          style={
            indeterminate
              ? { transformOrigin: `${c}px ${c}px`, animation: 'rz-orbit 1.1s linear infinite' }
              : undefined
          }
        >
          <circle
            cx={c}
            cy={c}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform={`rotate(-90 ${c} ${c})`}
            style={{ transition: 'stroke-dasharray 600ms cubic-bezier(0.2,0.7,0.2,1)', filter: `drop-shadow(0 0 6px ${color}88)` }}
          />
          {pct > 0 && (
            <circle cx={satX} cy={satY} r={stroke * 0.62} fill="#EAF6FF" style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
          )}
        </g>
      </svg>
      {children && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

interface OrbitLoaderProps {
  label?: string;
  size?: number;
  fullscreen?: boolean;
}

/** Carregamento padrão do app (substitui spinners genéricos). */
export const OrbitLoader: React.FC<OrbitLoaderProps> = ({ label, size = 44, fullscreen = false }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      height: fullscreen ? '100%' : undefined,
      minHeight: fullscreen ? '100%' : undefined,
      padding: fullscreen ? 0 : 24,
      background: fullscreen ? 'var(--rz-bg-base)' : undefined,
    }}
  >
    <OrbitRing size={size} stroke={3} spinning globe={false} label={label ?? 'Carregando'} />
    {label && (
      <span
        style={{
          fontFamily: 'var(--rz-font-display)',
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--rz-text-muted)',
        }}
      >
        {label}
      </span>
    )}
  </div>
);

export default OrbitRing;

