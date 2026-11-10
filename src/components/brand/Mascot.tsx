import React from 'react';
import mascotUrl from '../../assets/brand/mascot.webp';
import mascotSmUrl from '../../assets/brand/mascot-sm.webp';
import mascotQuestionUrl from '../../assets/brand/mascot-question.webp';

export type MascotVariant = 'default' | 'question';

interface MascotProps {
  /** Altura renderizada em px. Até ~180px usa a versão leve automaticamente quando variant='default'. */
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Texto alternativo; omita quando for puramente decorativo. */
  alt?: string;
  /** 'default' (tartaruga 3D com cadeado orbital) ou 'question' (tartaruga em dúvida com interrogação). */
  variant?: MascotVariant;
}

/**
 * Mascote RiskZero.
 * - 'default': Boas-vindas, sucesso, desbloqueio de cofre e guia.
 * - 'question': Cofre vazio, busca sem resultado, quiz/dúvidas e telas de ajuda.
 */
export const Mascot: React.FC<MascotProps> = ({
  height = 220,
  className,
  style,
  alt,
  variant = 'default',
}) => {
  const isQuestion = variant === 'question';
  const src = isQuestion ? mascotQuestionUrl : height <= 180 ? mascotSmUrl : mascotUrl;
  const aspectRatio = isQuestion ? 0.98 : 0.592;

  return (
    <img
      src={src}
      alt={alt ?? ''}
      aria-hidden={alt ? undefined : true}
      height={height}
      width={Math.round(height * aspectRatio)}
      className={`rz-mascot ${isQuestion ? 'is-question' : ''} ${className ?? ''}`}
      style={{ height, width: 'auto', ...style }}
      draggable={false}
      decoding="async"
      loading="lazy"
    />
  );
};

export default Mascot;
