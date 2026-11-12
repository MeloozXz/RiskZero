import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IonSpinner } from '@ionic/react';
import {
  Lock,
  Fingerprint,
  Delete,
  LogOut,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { Logo, Mascot, OrbitRing } from '../brand';
import { useSecurity } from '../../contexts/SecurityContext';
import { SessionService } from '../../services/session';
import { getErrorMessage } from '../../lib/utils';
import './LockOverlay.css';

export const LockOverlay: React.FC = () => {
  const {
    unlockWithPIN,
    unlockWithBiometrics,
    unlockWithMasterPassword,
    logout,
    isLocked,
    hasPIN,
    hasPanicPIN,
    isBiometricEnabled,
    activeEmail
  } = useSecurity();

  const [pin, setPin] = useState<string>('');
  const [masterPasswordInput, setMasterPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [usePasswordMode, setUsePasswordMode] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockoutSecs, setLockoutSecs] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const hasPinConfigured = hasPIN || hasPanicPIN;
  const showPinPad = hasPinConfigured && !usePasswordMode;

  useEffect(() => {
    let interval: NodeJS.Timeout | number | null = null;

    const checkLock = async () => {
      const lockout = await SessionService.checkLockout();
      if (lockout.isLocked) {
        setLockoutSecs(lockout.remainingSeconds);
        setPin('');
      } else {
        setLockoutSecs(0);
      }
    };

    if (isLocked) {
      checkLock();
      interval = setInterval(checkLock, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLocked]);

  if (!isLocked) {
    return null;
  }

  const handleMasterPasswordUnlock = async () => {
    if (!activeEmail || !masterPasswordInput.trim() || lockoutSecs > 0) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await unlockWithMasterPassword(masterPasswordInput);
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.error || 'Senha Mestra incorreta.');
      } else {
        setMasterPasswordInput('');
      }
    } catch (e: unknown) {
      setLoading(false);
      setErrorMsg(getErrorMessage(e) || 'Erro ao validar Senha Mestra.');
    }
  };

  const handleKeyPress = (num: string) => {
    if (lockoutSecs > 0 || loading) return;
    setErrorMsg(null);
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 6) {
        submitPIN(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (lockoutSecs > 0 || loading) return;
    setErrorMsg(null);
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  const submitPIN = async (pinCode: string) => {
    setLoading(true);
    setTimeout(async () => {
      const res = await unlockWithPIN(pinCode);
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.error || 'PIN incorreto. Tente novamente.');
        setPin('');
      }
    }, 300);
  };

  const handleBiometrics = async () => {
    if (lockoutSecs > 0 || loading) return;
    setErrorMsg(null);
    if (!isBiometricEnabled) {
      setErrorMsg('Biometria física não configurada neste dispositivo.');
      return;
    }
    setLoading(true);
    try {
      const success = await unlockWithBiometrics();
      setLoading(false);
      if (!success) {
        setErrorMsg('Leitura biométrica não confirmada.');
      }
    } catch {
      setLoading(false);
      setErrorMsg('Falha na comunicação com o leitor biométrico.');
    }
  };

  const overlayContent = (
    <div
      className="lock-overlay-container rz-meridian-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Cofre bloqueado"
    >
      <div className="lock-overlay-card">
        <div className="lock-brand-top">
          <Logo width={140} />
        </div>

        <div className="lock-guardian-stage">
          <OrbitRing
            size={132}
            stroke={4}
            value={loading ? undefined : errorMsg ? 100 : 78}
            spinning={loading}
            tone={errorMsg ? 'danger' : 'accent'}
            label="Status de bloqueio do cofre"
          >
            <Mascot height={110} />
          </OrbitRing>
        </div>

        <div className="lock-overlay-header">
          <div className="lock-status-pill">
            <Lock className="w-3.5 h-3.5" />
            <span>Sessão Criptografada Bloqueada</span>
          </div>

          <h2>Desbloquear Cofre</h2>

          {activeEmail && (
            <div className="lock-user-badge" title={activeEmail}>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="rz-truncate">{activeEmail}</span>
            </div>
          )}

          <p>
            {showPinPad
              ? 'Insira seu PIN de 6 dígitos ou autentique via hardware biométrico.'
              : 'Confirme sua Senha Mestra para restaurar as chaves em memória.'}
          </p>
        </div>

        {errorMsg && (
          <div className="rz-alert rz-alert-danger lock-error-banner" role="alert">
            <AlertTriangle />
            <span>{errorMsg}</span>
          </div>
        )}

        {lockoutSecs > 0 && (
          <div className="lockout-timer-container" role="timer">
            <p>Bloqueio temporário por tentativas excessivas</p>
            <h3 className="rz-num">
              {Math.floor(lockoutSecs / 60)}:{(lockoutSecs % 60).toString().padStart(2, '0')}
            </h3>
          </div>
        )}

        {showPinPad ? (
          <>
            <div className="pin-indicator-container" aria-label={`PIN: ${pin.length} de 6 dígitos`}>
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`pin-dot ${i < pin.length ? 'filled' : ''} ${errorMsg ? 'error' : ''}`}
                />
              ))}
            </div>

            <div className="numeric-keypad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  className="keypad-button rz-num"
                  disabled={lockoutSecs > 0 || loading}
                  onClick={() => handleKeyPress(num)}
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                className="keypad-button functional-key"
                disabled={lockoutSecs > 0 || loading || !isBiometricEnabled}
                onClick={handleBiometrics}
                title={isBiometricEnabled ? 'Usar leitor biométrico físico' : 'Biometria física indisponível'}
                aria-label="Autenticar com biometria"
              >
                <Fingerprint className="w-5 h-5" />
              </button>

              <button
                type="button"
                className="keypad-button rz-num"
                disabled={lockoutSecs > 0 || loading}
                onClick={() => handleKeyPress('0')}
              >
                0
              </button>

              <button
                type="button"
                className="keypad-button functional-key"
                disabled={lockoutSecs > 0 || loading}
                onClick={handleBackspace}
                aria-label="Apagar dígito"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              className="lock-mode-switch-btn"
              onClick={() => {
                setUsePasswordMode(true);
                setErrorMsg(null);
              }}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Usar Senha Mestra</span>
            </button>
          </>
        ) : (
          <div className="lock-password-form">
            <div className="rz-input-group lock-password-input-group">
              <KeyRound />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite sua Senha Mestra"
                value={masterPasswordInput}
                onChange={(e) => setMasterPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleMasterPasswordUnlock()}
                disabled={loading || lockoutSecs > 0}
                className="rz-input"
                aria-label="Senha Mestra"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="lock-pwd-toggle"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleMasterPasswordUnlock}
              disabled={loading || lockoutSecs > 0 || !masterPasswordInput.trim()}
              className="rz-btn rz-btn-primary rz-btn-lg rz-btn-block"
            >
              {loading ? (
                <IonSpinner name="crescent" style={{ width: '16px', height: '16px' }} />
              ) : (
                <>
                  <Lock />
                  <span>Desbloquear Cofre</span>
                </>
              )}
            </button>

            {isBiometricEnabled && (
              <button
                type="button"
                onClick={handleBiometrics}
                disabled={loading || lockoutSecs > 0}
                className="rz-btn rz-btn-secondary rz-btn-lg rz-btn-block"
              >
                <Fingerprint />
                <span>Desbloqueio Rápido com Biometria</span>
              </button>
            )}

            {hasPinConfigured && (
              <button
                type="button"
                className="lock-mode-switch-btn"
                onClick={() => {
                  setUsePasswordMode(false);
                  setErrorMsg(null);
                }}
              >
                <span>Voltar para o teclado PIN</span>
              </button>
            )}
          </div>
        )}

        <div className="lock-overlay-footer">
          <button type="button" className="lock-logout-btn" onClick={logout}>
            <LogOut className="w-4 h-4" />
            <span>Encerrar sessão</span>
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(overlayContent, document.body) : overlayContent;
};
