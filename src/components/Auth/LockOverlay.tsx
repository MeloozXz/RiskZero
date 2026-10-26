import React, { useState, useEffect } from 'react';
import { 
  IonButton, 
  IonIcon, 
  IonText,
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
    isBiometricEnabled, 
    activeEmail, 
    isBiometricsEnrolled 
  } = useSecurity();
  const [pin, setPin] = useState<string>('');
  const [masterPasswordInput, setMasterPasswordInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockoutSecs, setLockoutSecs] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const biometricActive = isBiometricEnabled || (activeEmail ? isBiometricsEnrolled(activeEmail) : false);
  const hasQuickUnlock = hasPIN || biometricActive;

  // Verifica proteção contra tentativas repetidas ao montar
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
        setErrorMsg(res.error || 'Senha mestra incorreta.');
      }
    } catch (e: unknown) {
      setLoading(false);
      setErrorMsg(getErrorMessage(e) || 'Erro ao validar senha mestra.');
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
    // Pequeno delay para feedback visual suave
    setTimeout(async () => {
      const res = await unlockWithPIN(pinCode);
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.error || 'PIN incorreto. Tente novamente.');
        setPin('');
      }
    }, 400);
  };

  const handleBiometrics = async () => {
    if (lockoutSecs > 0 || loading) return;
    setErrorMsg(null);
    if (!biometricActive) {
      setErrorMsg('Biometria não cadastrada. Digite seu PIN ou configure nas Configurações.');
      return;
    }
    setLoading(true);
    try {
      const success = await unlockWithBiometrics();
      setLoading(false);
      if (!success) {
        setErrorMsg('Não foi possível verificar sua identidade biométrica.');
      }
    } catch {
      setLoading(false);
      setErrorMsg('Falha ao validar biometria.');
    }
  };

  return (
    <div className="lock-overlay-container">
      <div className="lock-overlay-header">
        <IonIcon icon={lockClosedOutline} className="lock-icon-main pulse" />
        <h2>Seu cofre está protegido</h2>
        <p>
          {hasQuickUnlock 
            ? 'Digite seu PIN de 6 dígitos ou use a biometria para continuar.' 
            : 'Insira sua Senha Mestra para desbloquear o cofre.'}
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
            <div className="lock-error-container">
              <IonText color="danger"><p className="shake">{errorMsg}</p></IonText>
            </div>
          )}

          {lockoutSecs > 0 && (
            <div className="lockout-timer-container">
              <p>Muitas tentativas. Aguarde um momento.</p>
              <h3>{Math.floor(lockoutSecs / 60)}:{(lockoutSecs % 60).toString().padStart(2, '0')}</h3>
            </div>
          )}

          {loading && (
            <div className="lock-spinner">
              <IonSpinner name="crescent" color="primary" />
            </div>
          )}

          <div className="numeric-keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button 
                key={num} 
                className="keypad-button"
                disabled={lockoutSecs > 0 || loading}
                onClick={() => handleKeyPress(num)}
              >
                {num}
              </button>
            ))}

            <button 
              className="keypad-button functional-key"
              disabled={lockoutSecs > 0 || loading}
              onClick={handleBiometrics}
            >
              <IonIcon icon={fingerPrintOutline} />
            </button>

            <button 
              className="keypad-button"
              disabled={lockoutSecs > 0 || loading}
              onClick={() => handleKeyPress('0')}
            >
              0
            </button>

            <button 
              className="keypad-button functional-key"
              disabled={lockoutSecs > 0 || loading}
              onClick={handleBackspace}
            >
              <IonIcon icon={backspaceOutline} />
            </button>
          </div>
        </>
      ) : (
        <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '16px', margin: '20px 0' }}>
          <input
            type="password"
            placeholder="Sua Senha Mestra"
            value={masterPasswordInput}
            onChange={(e) => setMasterPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleMasterPasswordUnlock()}
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid rgba(96, 165, 250, 0.3)',
              background: 'rgba(15, 23, 42, 0.8)',
              color: '#ffffff',
              fontSize: '1rem',
              outline: 'none',
              textAlign: 'center'
            }}
          />
          {errorMsg && (
            <div className="lock-error-container">
              <IonText color="danger"><p className="shake">{errorMsg}</p></IonText>
            </div>
          )}
          <IonButton 
            expand="block" 
            onClick={handleMasterPasswordUnlock} 
            disabled={loading || !masterPasswordInput.trim()}
            style={{ '--background': 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)', fontWeight: 700 }}
          >
            {loading ? <IonSpinner name="crescent" /> : 'Desbloquear Cofre'}
          </IonButton>
        </div>
      )}

      <div className="lock-overlay-footer">
        <IonButton fill="clear" color="medium" onClick={logout}>
          <IonIcon slot="start" icon={logOutOutline} />
          Sair da Conta
        </IonButton>
      </div>
    </div>
  );
};

