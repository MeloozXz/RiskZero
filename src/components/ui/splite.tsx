import React from 'react';

interface SplineSceneProps {
  scene?: string;
  className?: string;
  onLoad?: () => void;
}

/**
 * Stub leve de retrocompatibilidade.
 * O Spline 3D foi completamente removido da autenticação para otimização de GPU/RAM.
 */
export function SplineScene({ className, onLoad }: SplineSceneProps) {
  React.useEffect(() => {
    if (onLoad) onLoad();
  }, [onLoad]);

  return null;
}

export default SplineScene;
