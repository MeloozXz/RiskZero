import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

interface SplineSceneProps {
  scene: string;
  className?: string;
  onLoad?: () => void;
}

/**
 * Error Boundary robusto para capturar falhas catastróficas de WebGL ou erros de importação do Spline.
 */
class SplineErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Falha crítica ao renderizar o Spline 3D:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Fallback Canvas 2D / Vector Robot para dispositivos de menor desempenho ou se WebGL falhar.
 * Mantém a animação fluida a 60fps e responsiva ao toque no mobile sem consumir memória excessiva.
 */
const FallbackRobotCanvas: React.FC<{ className?: string }> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;
    let touchX = canvas.width / 2;
    let touchY = canvas.height / 3;

    const handlePointer = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      touchX = clientX - rect.left;
      touchY = clientY - rect.top;
    };

    window.addEventListener('mousemove', handlePointer, { passive: true });
    window.addEventListener('touchmove', handlePointer, { passive: true });

    const render = () => {
      angle += 0.03;
      const width = (canvas.width = canvas.parentElement?.clientWidth || 300);
      const height = (canvas.height = canvas.parentElement?.clientHeight || 300);

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2.2;
      const eyeDx = (touchX - centerX) * 0.05;
      const eyeDy = (touchY - centerY) * 0.05;

      // Brilho Neon Cyber do Fundo
      const gradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, 180);
      gradient.addColorStop(0, 'rgba(0, 242, 254, 0.25)');
      gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.12)');
      gradient.addColorStop(1, 'rgba(7, 10, 19, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 200, 0, Math.PI * 2);
      ctx.fill();

      // Cabeça do Robô Futurista (Capacete Criptografado)
      ctx.save();
      ctx.translate(centerX, centerY + Math.sin(angle) * 6);

      // Capacete Principal
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-80, -70, 160, 140, [40, 40, 20, 20]);
      ctx.fill();
      ctx.stroke();

      // Viseira Neon Glossy
      ctx.fillStyle = '#070a13';
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-60, -40, 120, 70, [20, 20, 15, 15]);
      ctx.fill();
      ctx.stroke();

      // Olhos Cibernéticos Interativos (Seguem Touch / Cursor)
      ctx.fillStyle = '#00f2fe';
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 15;

      // Olho Esquerdo
      ctx.beginPath();
      ctx.arc(-25 + eyeDx, -5 + eyeDy, 10, 0, Math.PI * 2);
      ctx.fill();

      // Olho Direito
      ctx.beginPath();
      ctx.arc(25 + eyeDx, -5 + eyeDy, 10, 0, Math.PI * 2);
      ctx.fill();

      // Antena de Segurança Pulsante
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -70);
      ctx.lineTo(0, -95);
      ctx.stroke();

      ctx.fillStyle = Math.sin(angle * 2) > 0 ? '#00f2fe' : '#10b981';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, -100, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handlePointer);
      window.removeEventListener('touchmove', handlePointer);
    };
  }, []);

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center relative ${className || ''}`}>
      <canvas ref={canvasRef} className="w-full h-full max-w-lg max-h-lg touch-none" />
      <span className="text-xs text-cyan-400 font-semibold tracking-wider opacity-75 mt-2">
        Proteção Cibernética Ativa (60 FPS Mobile Mode)
      </span>
    </div>
  );
};

export function SplineScene({ scene, className, onLoad }: SplineSceneProps) {
  const [hasError, setHasError] = useState(false);
  const [isLowPowerDevice, setIsLowPowerDevice] = useState(false);

  useEffect(() => {
    // Detecta se o dispositivo móvel possui restrições de memória/hardware
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    if (isMobile && hardwareConcurrency <= 4) {
      setIsLowPowerDevice(true);
    }
  }, []);

  useEffect(() => {
    if ((hasError || isLowPowerDevice) && onLoad) {
      onLoad();
    }
  }, [hasError, isLowPowerDevice, onLoad]);

  if (hasError || isLowPowerDevice) {
    return <FallbackRobotCanvas className={className} />;
  }

  return (
    <SplineErrorBoundary fallback={<FallbackRobotCanvas className={className} />}>
      <Suspense fallback={<FallbackRobotCanvas className={className} />}>
        <Spline
          scene={scene}
          className={`${className || ''} touch-manipulation`}
          onLoad={onLoad}
          onError={() => setHasError(true)}
        />
      </Suspense>
    </SplineErrorBoundary>
  );
}
