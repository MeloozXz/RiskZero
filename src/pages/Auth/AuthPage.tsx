import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonContent,
  IonSpinner
} from '@ionic/react';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Fingerprint,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react';
import { useSecurity } from '../../contexts/SecurityContext';
import { StorageService } from '../../services/storage';
import { SessionService } from '../../services/session';
import { BiometricsService } from '../../services/biometrics';
import { getErrorMessage } from '../../lib/utils';
import './AuthPage.css';

export const AuthPage: React.FC = () => {
  const {
    register,
    login,
    login2FA,
    isBiometricsEnrolled,
    loginWithBiometrics,
    rememberSession,
    setRememberSession
  } = useSecurity();

  const [mode, setMode] = useState<'LOADING' | 'REGISTER' | 'LOGIN' | 'TOTP_VERIFY'>('LOADING');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [totpToken, setTotpToken] = useState<string>('');
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(true);

  const [hardwareAvailable, setHardwareAvailable] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lockoutSecs, setLockoutSecs] = useState<number>(0);

  const [pwdReqs, setPwdReqs] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  });

  useEffect(() => {
    async function initAuthScreen() {
      try {
        const [hasAccounts, hwStatus] = await Promise.all([
          StorageService.hasAnyAccount(),
          BiometricsService.checkHardwareStatus()
        ]);
        setHardwareAvailable(hwStatus.isNativeAvailable);
        setMode(hasAccounts ? 'LOGIN' : 'REGISTER');

        const enrolled = BiometricsService.getEnrolledEmails();
        if (enrolled.length > 0) {
          setEmail(enrolled[0]);
        }
      } catch (err) {
        console.error('Erro ao inicializar tela de autenticação:', err);
        setMode('REGISTER');
      }
    }
    initAuthScreen();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | number | null = null;

    const checkLock = async () => {
      const lockout = await SessionService.checkLockout();
      if (lockout.isLocked) {
        setLockoutSecs(lockout.remainingSeconds);
        setErrorMsg(lockout.message || 'Proteção contra tentativas excessivas ativa.');
      } else {
        if (lockoutSecs > 0) {
          setLockoutSecs(0);
          setErrorMsg(null);
        }
      }
    };

    if (mode === 'LOGIN') {
      checkLock();
      interval = setInterval(checkLock, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mode, lockoutSecs]);

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    setPwdReqs({
      length: val.length >= 12,
      upper: /[A-Z]/.test(val),
      lower: /[a-z]/.test(val),
      number: /[0-9]/.test(val),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(val)
    });
  };

  const isPasswordValid = () => {
    return pwdReqs.length && pwdReqs.upper && pwdReqs.lower && pwdReqs.number && pwdReqs.special;
  };

  const calculateStrengthScore = () => {
    let score = 0;
    if (pwdReqs.length) score++;
    if (pwdReqs.upper && pwdReqs.lower) score++;
    if (pwdReqs.number) score++;
    if (pwdReqs.special) score++;
    return score;
  };

  const strengthScore = calculateStrengthScore();
  const strengthLabels = ['Fraca', 'Razoável', 'Forte', 'Excelente'];
  const strengthColors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];

  const switchTab = (targetMode: 'LOGIN' | 'REGISTER') => {
    if (mode === targetMode) return;
    setMode(targetMode);
    setPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
    setSuccessMsg(null);
    setPwdReqs({ length: false, upper: false, lower: false, number: false, special: false });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Informe o seu e-mail.');
      return;
    }

    if (!password) {
      setErrorMsg('Informe a sua Senha Mestra.');
      return;
    }

    setLoading(true);
    try {
      const res = await login(email, password);
      setLoading(false);
      if (res.success) {
        if ('requires2FA' in res && res.requires2FA) {
          setMode('TOTP_VERIFY');
        } else {
          setSuccessMsg('Autenticação concluída. Desbloqueando cofre...');
        }
      } else {
        setErrorMsg(res.error || 'Credenciais inválidas.');
      }
    } catch (err: unknown) {
      setLoading(false);
      setErrorMsg(getErrorMessage(err) || 'Erro ao efetuar login.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Informe um endereço de e-mail válido.');
      return;
    }

    if (!isPasswordValid()) {
      setErrorMsg('A Senha Mestra deve atender a todos os critérios de segurança.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('A confirmação da Senha Mestra não confere.');
      return;
    }

    if (!acceptedTerms) {
      setErrorMsg('Você precisa concordar com os termos de criptografia Zero-Knowledge e LGPD.');
      return;
    }

    setLoading(true);
    try {
      await StorageService.saveSecurityTermsAccepted(email.trim(), 'v1.0');
      const res = await register(email, password);
      setLoading(false);
      if (res.success) {
        setSuccessMsg('Cofre criado com sucesso. Inicializando sessão...');
      } else {
        setErrorMsg(res.error || 'Erro ao criar conta.');
      }
    } catch (err: unknown) {
      setLoading(false);
      setErrorMsg(getErrorMessage(err) || 'Erro inesperado ao criar conta.');
    }
  };

  const handleBiometricLogin = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!hardwareAvailable) {
      setErrorMsg('Nenhum leitor biométrico físico (Windows Hello / Touch ID / Impressão Digital) detectado neste dispositivo.');
      return;
    }

    let targetEmail = email.trim();
    if (!targetEmail) {
      const enrolled = BiometricsService.getEnrolledEmails();
      if (enrolled.length > 0) {
        targetEmail = enrolled[0];
        setEmail(targetEmail);
      } else {
        setErrorMsg('Nenhuma biometria vinculada neste aparelho. Entre com sua Senha Mestra e ative em Biometria.');
        return;
      }
    }

    if (!BiometricsService.isEnrolled(targetEmail)) {
      setErrorMsg(`Biometria não configurada para "${targetEmail}" neste dispositivo.`);
      return;
    }

    setLoading(true);
    try {
      const res = await loginWithBiometrics(targetEmail);
      setLoading(false);
      if (res.success) {
        if ('requires2FA' in res && res.requires2FA) {
          setMode('TOTP_VERIFY');
        } else {
          setSuccessMsg('Identidade biométrica confirmada.');
        }
      } else {
        setErrorMsg(res.error || 'Verificação biométrica não concluída.');
      }
    } catch (err: unknown) {
      setLoading(false);
      setErrorMsg(getErrorMessage(err) || 'Falha ao acionar leitor biométrico.');
    }
  };

  const handleBiometricRecovery = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!hardwareAvailable) {
      setErrorMsg('Recuperação biométrica requer leitor físico habilitado no dispositivo.');
      return;
    }

    let targetEmail = email.trim();
    if (!targetEmail) {
      const enrolled = BiometricsService.getEnrolledEmails();
      if (enrolled.length > 0) {
        targetEmail = enrolled[0];
        setEmail(targetEmail);
      } else {
        setErrorMsg('Informe o e-mail da conta com biometria vinculada.');
        return;
      }
    }

    if (!isBiometricsEnrolled(targetEmail)) {
      setErrorMsg('Esta conta não possui biometria física registrada neste dispositivo.');
      return;
    }

    setLoading(true);
    try {
      const res = await BiometricsService.authenticate(targetEmail);
      setLoading(false);

      if (res.success && res.masterPassword) {
        const loginRes = await login(targetEmail, res.masterPassword);
        if (loginRes.success) {
          if ('requires2FA' in loginRes && loginRes.requires2FA) {
            setMode('TOTP_VERIFY');
          } else {
            setSuccessMsg('Acesso restaurado via hardware biométrico.');
          }
        } else {
          setErrorMsg(loginRes.error || 'Falha ao desbloquear cofre.');
        }
      } else {
        setErrorMsg(res.error || 'Leitura biométrica cancelada.');
      }
    } catch (err: unknown) {
      setLoading(false);
      setErrorMsg(getErrorMessage(err) || 'Erro na validação biométrica.');
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (totpToken.length !== 6 || isNaN(Number(totpToken))) {
      setErrorMsg('O código TOTP deve conter 6 dígitos numéricos.');
      return;
    }

    setLoading(true);
    try {
      const activeUser = SessionService.getActiveUserEmail();
      if (activeUser) {
        const res = await login2FA(totpToken);
        setLoading(false);
        if (res.success) {
          setSuccessMsg('Código 2FA verificado.');
        } else {
          setErrorMsg('Código inválido ou expirado.');
        }
      } else {
        setLoading(false);
        setErrorMsg('Sessão expirada. Refaça o login.');
      }
    } catch (err: unknown) {
      setLoading(false);
      setErrorMsg(getErrorMessage(err) || 'Erro ao validar código 2FA.');
    }
  };

  const enrolledEmails = BiometricsService.getEnrolledEmails();
  const canUseBiometricUnlock = hardwareAvailable && enrolledEmails.length > 0;

  if (mode === 'LOADING') {
    return (
      <IonPage>
        <IonContent className="auth-lightweight-page">
          <div className="auth-loading-state" role="status" aria-label="Carregando ambiente">
            <IonSpinner name="crescent" style={{ color: '#3b82f6', width: '28px', height: '28px' }} />
            <span className="auth-loading-text">Inicializando cofre...</span>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent className="auth-lightweight-page">
        <div className="auth-screen-container">
          <main className="auth-saas-card" aria-labelledby="auth-brand-heading">
            <header className="auth-brand-header">
              <div className="auth-logo-mark" aria-hidden="true">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="auth-brand-meta">
                <h1 id="auth-brand-heading" className="brand-title">
                  RiskZero
                </h1>
                <p className="brand-tagline">Cofre Corporativo Zero-Knowledge</p>
              </div>
            </header>

            {mode !== 'TOTP_VERIFY' && (
              <nav className="auth-segmented-tabs" role="tablist" aria-label="Modo de autenticação">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'LOGIN'}
                  className={`tab-toggle-btn ${mode === 'LOGIN' ? 'active' : ''}`}
                  onClick={() => switchTab('LOGIN')}
                >
                  Acessar cofre
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'REGISTER'}
                  className={`tab-toggle-btn ${mode === 'REGISTER' ? 'active' : ''}`}
                  onClick={() => switchTab('REGISTER')}
                >
                  Criar conta
                </button>
              </nav>
            )}

            {errorMsg && (
              <div className="auth-feedback-alert error" role="alert">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="auth-feedback-alert success" role="status">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* LOGIN */}
            {mode === 'LOGIN' && (
              <form onSubmit={handleLogin} className="auth-form-body" noValidate>
                <div className="form-field-group">
                  <label htmlFor="login-email" className="field-label">
                    E-mail
                  </label>
                  <div className="field-input-wrapper">
                    <input
                      id="login-email"
                      type="email"
                      inputMode="email"
                      autoComplete="username"
                      placeholder="nome@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading || lockoutSecs > 0}
                      required
                      className="clean-text-input"
                    />
                  </div>
                </div>

                <div className="form-field-group">
                  <div className="field-label-row">
                    <label htmlFor="login-password" className="field-label">
                      Senha Mestra
                    </label>
                    {canUseBiometricUnlock && (
                      <button
                        type="button"
                        onClick={handleBiometricRecovery}
                        className="auth-inline-link"
                      >
                        Usar biometria física
                      </button>
                    )}
                  </div>
                  <div className="field-input-wrapper">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Digite sua Senha Mestra"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading || lockoutSecs > 0}
                      required
                      className="clean-text-input pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      onClick={() => setShowPassword(!showPassword)}
                      className="field-adornment-btn"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <label htmlFor="remember-session-check" className="auth-checkbox-row">
                  <input
                    id="remember-session-check"
                    type="checkbox"
                    checked={rememberSession}
                    onChange={(e) => setRememberSession(e.target.checked)}
                    className="auth-checkbox-input"
                  />
                  <span className="auth-checkbox-label">
                    Manter sessão criptografada ativa ao recarregar a página
                  </span>
                </label>

                {lockoutSecs > 0 ? (
                  <div className="lockout-warning-card" role="alert">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <div>
                      <h3 className="lockout-title">Bloqueio temporário ativo</h3>
                      <p className="lockout-desc">
                        Muitas tentativas incorretas. Aguarde <strong>{lockoutSecs}s</strong>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="auth-actions-stack">
                    <button
                      type="submit"
                      disabled={loading}
                      className="primary-action-btn"
                    >
                      {loading ? (
                        <span className="btn-content-inline">
                          <IonSpinner name="crescent" style={{ width: '16px', height: '16px' }} />
                          <span>Autenticando...</span>
                        </span>
                      ) : (
                        <span className="btn-content-inline">
                          <Lock className="w-4 h-4" />
                          <span>Desbloquear cofre</span>
                        </span>
                      )}
                    </button>

                    {canUseBiometricUnlock && (
                      <button
                        type="button"
                        onClick={handleBiometricLogin}
                        disabled={loading}
                        className="secondary-biometric-btn"
                      >
                        <Fingerprint className="w-4 h-4 shrink-0" />
                        <span>Entrar com Biometria do Dispositivo</span>
                      </button>
                    )}
                  </div>
                )}
              </form>
            )}

            {/* CADASTRO */}
            {mode === 'REGISTER' && (
              <form onSubmit={handleRegister} className="auth-form-body" noValidate>
                <div className="form-field-group">
                  <label htmlFor="reg-email" className="field-label">
                    E-mail corporativo ou pessoal
                  </label>
                  <div className="field-input-wrapper">
                    <input
                      id="reg-email"
                      type="email"
                      inputMode="email"
                      autoComplete="username"
                      placeholder="nome@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      required
                      className="clean-text-input"
                    />
                  </div>
                </div>

                <div className="form-field-group">
                  <label htmlFor="reg-password" className="field-label">
                    Definir Senha Mestra
                  </label>
                  <div className="field-input-wrapper">
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Mínimo de 12 caracteres"
                      value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      disabled={loading}
                      required
                      className="clean-text-input pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      onClick={() => setShowPassword(!showPassword)}
                      className="field-adornment-btn"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="password-health-container" aria-live="polite">
                  <div className="strength-meter-header">
                    <span>Entropia da Senha Mestra</span>
                    <span
                      style={{
                        color: password.length === 0 ? '#71717a' : strengthColors[Math.max(0, strengthScore - 1)],
                        fontWeight: 600
                      }}
                    >
                      {password.length === 0 ? 'Aguardando' : strengthLabels[Math.max(0, strengthScore - 1)]}
                    </span>
                  </div>

                  <div className="strength-bars-row">
                    {[0, 1, 2, 3].map((step) => (
                      <div
                        key={step}
                        className="strength-bar-segment"
                        style={{
                          backgroundColor:
                            step < strengthScore && password.length > 0
                              ? strengthColors[Math.max(0, strengthScore - 1)]
                              : '#27272a'
                        }}
                      />
                    ))}
                  </div>

                  <div className="requirements-checklist">
                    <div className={`check-rule ${pwdReqs.length ? 'met' : ''}`}>
                      {pwdReqs.length ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
                      <span>12+ caracteres</span>
                    </div>
                    <div className={`check-rule ${pwdReqs.upper ? 'met' : ''}`}>
                      {pwdReqs.upper ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
                      <span>Maiúscula (A-Z)</span>
                    </div>
                    <div className={`check-rule ${pwdReqs.lower ? 'met' : ''}`}>
                      {pwdReqs.lower ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
                      <span>Minúscula (a-z)</span>
                    </div>
                    <div className={`check-rule ${pwdReqs.number ? 'met' : ''}`}>
                      {pwdReqs.number ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
                      <span>Número (0-9)</span>
                    </div>
                    <div className={`check-rule ${pwdReqs.special ? 'met' : ''}`}>
                      {pwdReqs.special ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
                      <span>Símbolo (!@#$...)</span>
                    </div>
                  </div>
                </div>

                <div className="form-field-group">
                  <label htmlFor="reg-confirm" className="field-label">
                    Confirmar Senha Mestra
                  </label>
                  <div className="field-input-wrapper">
                    <input
                      id="reg-confirm"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Repita a Senha Mestra"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      required
                      className="clean-text-input"
                    />
                  </div>
                </div>

                <div className="security-notice-box">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-zinc-400" />
                  <p>
                    <strong>Arquitetura Zero-Knowledge:</strong> Sua Senha Mestra deriva as chaves AES-256-GCM localmente e jamais é enviada ao servidor. Caso perdida, não poderá ser recuperada.
                  </p>
                </div>

                <label htmlFor="accept-terms-check" className="auth-checkbox-row">
                  <input
                    id="accept-terms-check"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="auth-checkbox-input"
                  />
                  <span className="auth-checkbox-label">
                    Compreendo a arquitetura Zero-Knowledge e concordo com os termos de privacidade (LGPD).
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!isPasswordValid() || !acceptedTerms || loading}
                  className="primary-action-btn"
                >
                  {loading ? (
                    <span className="btn-content-inline">
                      <IonSpinner name="crescent" style={{ width: '16px', height: '16px' }} />
                      <span>Derivando chaves Argon2id...</span>
                    </span>
                  ) : (
                    <span>Criar cofre criptografado</span>
                  )}
                </button>
              </form>
            )}

            {/* 2FA TOTP */}
            {mode === 'TOTP_VERIFY' && (
              <form onSubmit={handleVerify2FA} className="auth-form-body" noValidate>
                <div className="totp-header-block">
                  <div className="totp-badge-icon-box">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="totp-title">Verificação em Duas Etapas</h2>
                    <p className="totp-subtitle">
                      Insira o código TOTP de 6 dígitos gerado pelo seu aplicativo autenticador.
                    </p>
                  </div>
                </div>

                <div className="form-field-group">
                  <label htmlFor="totp-input" className="field-label">
                    Código de 6 dígitos
                  </label>
                  <div className="field-input-wrapper">
                    <input
                      id="totp-input"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="one-time-code"
                      placeholder="000000"
                      value={totpToken}
                      onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                      disabled={loading}
                      required
                      className="clean-text-input totp-code-input"
                    />
                  </div>
                </div>

                <div className="auth-actions-stack">
                  <button
                    type="submit"
                    disabled={loading || totpToken.length !== 6}
                    className="primary-action-btn"
                  >
                    {loading ? 'Validando...' : 'Confirmar código'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('LOGIN');
                      setTotpToken('');
                      setErrorMsg(null);
                    }}
                    className="secondary-biometric-btn"
                  >
                    Voltar para o login
                  </button>
                </div>
              </form>
            )}
          </main>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AuthPage;

