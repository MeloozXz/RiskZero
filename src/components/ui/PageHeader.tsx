import React from 'react';

interface PageHeaderProps {
  /** Rótulo curto acima do título (categoria/contexto). */
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  /** Botões/ações à direita no desktop; ocupam a largura total no celular. */
  actions?: React.ReactNode;
  className?: string;
}

/** Cabeçalho padrão de todas as páginas internas. */
export const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, title, subtitle, actions, className }) => (
  <header className={`rz-page-header ${className ?? ''}`}>
    <div style={{ minWidth: 0 }}>
      {eyebrow && <p className="rz-eyebrow">{eyebrow}</p>}
      <h1 className="rz-page-title">{title}</h1>
      {subtitle && <p className="rz-page-subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="rz-page-actions">{actions}</div>}
  </header>
);

export default PageHeader;

