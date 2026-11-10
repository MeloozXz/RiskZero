import React from 'react';
import { Mascot, MascotVariant } from '../brand/Mascot';

interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  /** Ícone (lucide) exibido quando o mascote não é usado. */
  icon?: React.ReactNode;
  /** Mostra o mascote (estados vazios importantes e mensagens de sucesso). */
  mascot?: boolean;
  mascotHeight?: number;
  mascotVariant?: MascotVariant;
  action?: React.ReactNode;
  className?: string;
}

/** Estado vazio/sucesso padronizado. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  mascot = false,
  mascotHeight = 170,
  mascotVariant = 'default',
  action,
  className,
}) => (
  <div className={`rz-empty ${className ?? ''}`}>
    {mascot ? (
      <Mascot height={mascotHeight} variant={mascotVariant} style={{ marginBottom: 6 }} />
    ) : (
      icon && <div className="rz-icon-tile lg">{icon}</div>
    )}
    <h3 className="rz-empty-title">{title}</h3>
    {description && <p className="rz-empty-text">{description}</p>}
    {action && <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>{action}</div>}
  </div>
);

export default EmptyState;
