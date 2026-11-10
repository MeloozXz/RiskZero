import React, { useState, useEffect } from 'react';
import {
  IonIcon,
  IonSpinner
} from '@ionic/react';
import { lockClosedOutline, fingerPrintOutline, backspaceOutline, logOutOutline } from 'ionicons/icons';
import { useSecurity } from '../../contexts/SecurityContext';
import { SessionService } from '../../services/session';
import { getErrorMessage } from '../../lib/utils';
import './LockOverlay.css';

export const LockOverlay: React.FC = () => {
  const {
    unlockWithPIN,
    unlockWithBiometrics,
    login,
    logout,
    isLocked,
    hasPIN,
    hasPanicPIN,
    isBiometricEnabled,
    activeEmail
  } = useSecurity();

  const [pin, setPin] = useState<string>('');
  const [masterPasswordInput, setMasterPasswordInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockoutSecs, setLockoutSecs] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const hasQuickUnlock = hasPIN || hasPanicPIN || isBiometricEnabled;

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
    if (!activeEmail || !masterPasswordInput.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await login(activeEmail, masterPasswordInput);
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.error || 'Senha Mestra incorreta.');
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

  return (
    <div className="lock-overlay-container" role="dialog" aria-modal="true" aria-label="Cofre bloqueado">
      <div className="lock-overlay-card">
        <div className="lock-overlay-header">
          <div className="lock-icon-badge">
            <IonIcon icon={lockClosedOutline} />
          </div>
          <h2>Sessão Bloqueada</h2>
          <p>
            {hasQuickUnlock
              ? 'Insira seu PIN de 6 dígitos ou autentique via hardware biométrico.'
              : 'Confirme sua Senha Mestra para retomar a sessão.'}
          </p>
        </div>

        {hasQuickUnlock ? (
          <>
            <div className="pin-indicator-container">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`pin-dot ${i < pin.length ? 'filled' : ''} ${errorMsg ? 'error' : ''}`}
                />
              ))}
            </div>

            {errorMsg && (
              <div className="lock-error-banner">
                <span>{errorMsg}</span>
              </div>
            )}

            {lockoutSecs > 0 && (
              <div className="lockout-timer-container">
                <p>Bloqueio temporário por segurança</p>
                <h3>
                  {Math.floor(lockoutSecs / 60)}:{(lockoutSecs % 60).toString().padStart(2, '0')}
                </h3>
              </div>
            )}

            {loading && (
              <div className="lock-spinner">
                <IonSpinner name="crescent" style={{ color: '#3b82f6', width: '22px', height: '22px' }} />
              </div>
            )}

            <div className="numeric-keypad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  className="keypad-button"
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
              >
                <IonIcon icon={fingerPrintOutline} />
              </button>

              <button
                type="button"
                className="keypad-button"
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
                <IonIcon icon={backspaceOutline} />
              </button>
            </div>
          </>
        ) : (
          <div className="lock-password-form">
            <input
              type="password"
              placeholder="Digite sua Senha Mestra"
              value={masterPasswordInput}
              onChange={(e) => setMasterPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMasterPasswordUnlock()}
              disabled={loading}
              className="rz-input"
            />
            {errorMsg && (
              <div className="lock-error-banner">
                <span>{errorMsg}</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleMasterPasswordUnlock}
              disabled={loading || !masterPasswordInput.trim()}
              className="rz-btn rz-btn-primary"
              style={{ width: '100%' }}
            >
              {loading ? <IonSpinner name="crescent" style={{ width: '16px', height: '16px' }} /> : 'Desbloquear Cofre'}
            </button>
          </div>
        )}

        <div className="lock-overlay-footer">
          <button type="button" className="lock-logout-btn" onClick={logout}>
            <IonIcon icon={logOutOutline} />
            <span>Encerrar sessão</span>
          </button>
        </div>
      </div>
    </div>
  );
};
