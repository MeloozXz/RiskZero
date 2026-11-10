import React, { useState, useEffect, useRef } from 'react';
import { Fingerprint, CheckCircle2, ShieldCheck } from 'lucide-react';
import { OrbitRing } from '../brand';
import { registerBiometricPromptHandler, BiometricType } from '../../services/biometrics';
import './BiometricScannerModal.css';

interface PromptRequest {
  email: string;
  mode: 'REGISTER' | 'AUTH';
  biometricType: BiometricType;
  resolve: (value: boolean) => void;
}

export const BiometricScannerModal: React.FC = () => {
  const [request, setRequest] = useState<PromptRequest | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [instruction, setInstruction] = useState<string>('Pressione o sensor com seu dedo');

  const activeResolver = useRef<((value: boolean) => void) | null>(null);

  useEffect(() => {
    registerBiometricPromptHandler((params) => {
      return new Promise<boolean>((resolve) => {
        activeResolver.current = resolve;
        setIsScanning(false);
        setIsVerified(false);
        setInstruction(
          params.mode === 'REGISTER'
            ? 'Toque no sensor para vincular sua biometria'
            : 'Toque no sensor para desbloquear o cofre'
        );
        setRequest({
          ...params,
          resolve
        });
      });
    });

    return () => {
      registerBiometricPromptHandler(null);
    };
  }, []);

  const handleTouchSensor = () => {
    if (isScanning || isVerified || !request) return;

    setIsScanning(true);
    setInstruction('Validando biometria...');

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([30, 40, 30]);
      } catch {
        // ignora
      }
    }

    setTimeout(() => {
      setIsScanning(false);
      setIsVerified(true);
      setInstruction('Biometria verificada com sucesso.');

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(60);
        } catch {
          // ignora
        }
      }

      setTimeout(() => {
        const resolve = activeResolver.current;
        setRequest(null);
        activeResolver.current = null;
        if (resolve) resolve(true);
      }, 500);
    }, 700);
  };

  const handleCancel = () => {
    const resolve = activeResolver.current;
    setRequest(null);
    activeResolver.current = null;
    if (resolve) resolve(false);
  };

  if (!request) return null;

  return (
    <div className="cyber-bio-modal-backdrop" onClick={handleCancel}>
      <div
        className="cyber-bio-modal-card rz-meridian-bg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bio-modal-title"
      >
        <div className="cyber-bio-header">
          <div className="cyber-bio-badge">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero-Knowledge Secure Sensor</span>
          </div>
          <h3 id="bio-modal-title" className="cyber-bio-title">
            {request.mode === 'REGISTER' ? 'Cadastrar Biometria' : 'Autenticação Biométrica'}
          </h3>
          <p className="cyber-bio-subtitle">
            Conta: <strong className="cyber-bio-email">{request.email}</strong>
          </p>
        </div>

        <div className="cyber-sensor-orbit-wrap">
          <OrbitRing
            size={164}
            stroke={4}
            value={isVerified ? 100 : isScanning ? undefined : 72}
            spinning={isScanning}
            tone={isVerified ? 'success' : 'accent'}
            label="Anel orbital do sensor biométrico"
          >
            <button
              type="button"
              className={`cyber-sensor-pad ${isScanning ? 'scanning' : ''} ${isVerified ? 'verified' : ''}`}
              onClick={handleTouchSensor}
              aria-label="Sensor Biométrico"
            >
              <div className="cyber-sensor-pulse-ring" />
              {isVerified ? (
                <CheckCircle2 className="cyber-sensor-icon" />
              ) : (
                <Fingerprint className="cyber-sensor-icon" />
              )}
              {isScanning && <div className="cyber-scan-laser" />}
            </button>
          </OrbitRing>
        </div>

        <div className={`cyber-instruction-text ${isVerified ? 'is-verified' : ''}`}>
          {instruction}
        </div>
        <div className="cyber-instruction-hint">
          {isVerified ? 'Liberando acesso...' : 'Clique ou encoste o dedo no sensor acima'}
        </div>

        <button
          type="button"
          className="rz-btn rz-btn-secondary rz-btn-lg rz-btn-block cyber-bio-cancel-btn"
          onClick={handleCancel}
          disabled={isScanning || isVerified}
        >
          Cancelar / Usar Senha Mestra
        </button>
      </div>
    </div>
  );
};
