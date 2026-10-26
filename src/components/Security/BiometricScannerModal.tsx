import React, { useState, useEffect, useRef } from 'react';
import { IonIcon } from '@ionic/react';
import { fingerPrintOutline, checkmarkCircle, shieldCheckmarkOutline } from 'ionicons/icons';
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
        className="cyber-bio-modal-card" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="cyber-bio-header">
          <div className="cyber-bio-badge">
            <IonIcon icon={shieldCheckmarkOutline} />
            <span>Zero-Knowledge Secure Sensor</span>
          </div>
          <h3 className="cyber-bio-title">
            {request.mode === 'REGISTER' ? 'Cadastrar Biometria' : 'Autenticação Biométrica'}
          </h3>
          <p className="cyber-bio-subtitle">
            Conta: <strong style={{ color: '#60a5fa' }}>{request.email}</strong>
          </p>
        </div>

        <button
          type="button"
          className={`cyber-sensor-pad ${isScanning ? 'scanning' : ''} ${isVerified ? 'verified' : ''}`}
          onClick={handleTouchSensor}
          aria-label="Sensor Biométrico"
        >
          <div className="cyber-sensor-pulse-ring" />
          <IonIcon
            icon={isVerified ? checkmarkCircle : fingerPrintOutline}
            className="cyber-sensor-icon"
          />
          {isScanning && <div className="cyber-scan-laser" />}
        </button>

        <div className="cyber-instruction-text" style={{ color: isVerified ? '#10b981' : '#e2e8f0' }}>
          {instruction}
        </div>
        <div className="cyber-instruction-hint">
          {isVerified ? 'Liberando acesso...' : 'Clique ou encoste o dedo no sensor acima'}
        </div>

        <button 
          type="button" 
          className="cyber-bio-cancel-btn" 
          onClick={handleCancel}
          disabled={isScanning || isVerified}
        >
          Cancelar / Usar Senha Mestra
        </button>
      </div>
    </div>
  );
};
