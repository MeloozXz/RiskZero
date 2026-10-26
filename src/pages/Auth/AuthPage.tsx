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
  Sparkles,
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
  
  // Modos: 'LOADING' | 'REGISTER' | 'LOGIN' | 'TOTP_VERIFY'
  const [mode, setMode] = useState<'LOADING' | 'REGISTER' | 'LOGIN' | 'TOTP_VERIFY'>('LOADING');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [totpToken, setTotpToken] = useState<string>('');
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lockoutSecs, setLockoutSecs] = useState<number>(0);

  // Requisitos da senha mestra para validação em tempo real
  const [pwdReqs, setPwdReqs] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  });

  // Checa se existe qualquer conta no dispositivo para definir modo inicial
  useEffect(() => {
    async function checkUserExistence() {
      try {
        const hasAccounts = await StorageService.hasAnyAccount();
        setMode(hasAccounts ? 'LOGIN' : 'REGISTER');
        const enrolled = BiometricsService.getEnrolledEmails();
        if (enrolled.length > 0) {
          setEmail(enrolled[0]);
        }
      } catch (err) {
        console.error('Erro ao verificar contas locais:', err);
        setMode('REGISTER');
      }
    }
    checkUserExistence();
  }, []);

  // Monitora estado de bloqueio por força bruta
  useEffect(() => {
    let interval: NodeJS.Timeout | number | null = null;

    const checkLock = async () => {
      const lockout = await SessionService.checkLockout();
      if (lockout.isLocked) {
        setLockoutSecs(lockout.remainingSeconds);
        setErrorMsg(lockout.message || 'Defesa contra Força Bruta ativa.');
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

  // Atualiza validação da senha em tempo real
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

  // Cálculo da pontuação de força da senha (0 a 4)
  const calculateStrengthScore = () => {
    let score = 0;
    if (pwdReqs.length) score++;
    if (pwdReqs.upper && pwdReqs.lower) score++;
    if (pwdReqs.number) score++;
    if (pwdReqs.special) score++;
    return score;
  };

  const strengthScore = calculateStrengthScore();
  const strengthLabels = ['Muito Fraca', 'Razoável', 'Boa', 'Excelente'];
  const strengthColors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];

  // Alterna entre abas Login e Cadastro
  const switchTab = (targetMode: 'LOGIN' | 'REGISTER') => {
    if (mode === targetMode) return;
    setMode(targetMode);
    setPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
    setSuccessMsg(null);
    setPwdReqs({ length: false, upper: false, lower: false, number: false, special: false });
  };

  // Ação de Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Digite o seu e-mail ou usuário.');
      return;
    }

    if (!password) {
      setErrorMsg('Digite a sua Senha Mestra.');
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
          setSuccessMsg('Autenticação bem-sucedida! Desbloqueando...');
        }
      } else {
        setErrorMsg(res.error || 'Senha mestra incorreta.');
      }
    } catch (err: unknown) {
      setLoading(false);
      setErrorMsg(getErrorMessage(err) || 'Erro ao efetuar login.');
    }
  };

  // Ação de Cadastro
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Por favor, informe um e-mail válido.');
      return;
    }

    if (!isPasswordValid()) {
      setErrorMsg('A senha mestra não cumpre todos os requisitos de segurança.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const res = await register(email, password);
      setLoading(false);
      if (res.success) {
        setSuccessMsg('Cofre criado com sucesso! Inicializando ambiente seguro...');
      } else {
        setErrorMsg(res.error || 'Erro ao registrar usuário.');
      }
    } catch (err: unknown) {
      setLoading(false);
      setErrorMsg(getErrorMessage(err) || 'Erro inesperado ao registrar.');
    }
  };

  // Login com Biometria
  const handleBiometricLogin = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    let targetEmail = email.trim();
    if (!targetEmail) {
      const enrolled = BiometricsService.getEnrolledEmails();
      if (enrolled.length > 0) {
        targetEmail = enrolled[0];
        setEmail(targetEmail);
      } else {
        setErrorMsg('Nenhuma biometria cadastrada neste dispositivo. Faça login com sua Senha Mestra primeiro e ative a biometria em Configurações > Biometria.');
        return;
      }
    }

    if (!BiometricsService.isEnrolled(targetEmail)) {
      const allEnrolled = BiometricsService.getEnrolledEmails();
      if (allEnrolled.length > 0) {
        setErrorMsg(`A biometria está ativada para "${allEnrolled.join(', ')}", mas não para "${targetEmail}".`);
      } else {
        setErrorMsg(`A biometria ainda não foi cadastrada para "${targetEmail}". Faça login com sua Senha Mestra e ative nas Configurações.`);
      }
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
          setSuccessMsg('Autenticação biométrica bem-sucedida! Desbloqueando...');
        }
      } else {
        setErrorMsg(res.error || 'A validação biométrica falhou.');
      }
    } catch (err: unknown) {
      setLoading(false);
      setErrorMsg(getErrorMessage(err) || 'Erro ao autenticar com a biometria.');
    }
  };

  // Recuperação de acesso via Biometria
  const handleBiometricRecovery = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    let targetEmail = email.trim();
    if (!targetEmail) {
      const enrolled = BiometricsService.getEnrolledEmails();
      if (enrolled.length > 0) {
        targetEmail = enrolled[0];
        setEmail(targetEmail);
      } else {
        setErrorMsg('Informe o e-mail cadastrado para recuperar via biometria.');
        return;
      }
    }

    try {
      const enrolled = isBiometricsEnrolled(targetEmail);
      if (!enrolled) {
        setErrorMsg('A biometria não está cadastrada para esta conta neste aparelho.');
        return;
      }

      setLoading(true);
      const res = await BiometricsService.authenticate(targetEmail);
      setLoading(false);

      if (res.success && res.masterPassword) {
        const loginRes = await login(targetEmail, res.masterPassword);
        if (loginRes.success) {
          if ('requires2FA' in loginRes && loginRes.requires2FA) {
            setMode('TOTP_VERIFY');
          } else {
            setSuccessMsg('Acesso recuperado com sucesso via Biometria!');
          }
        } else {
          setErrorMsg(loginRes.error || 'Falha ao autenticar com a biometria.');
        }
      } else {
        setErrorMsg(res.error || 'Autenticação biométrica não autorizada.');
      }
    } catch (err: unknown) {
      setLoading(false);
      setErrorMsg(getErrorMessage(err) || 'Erro na recuperação biométrica.');
    }
  };

  // Verificação de 2FA TOTP
  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    
    if (totpToken.length !== 6 || isNaN(Number(totpToken))) {
      setErrorMsg('O código 2FA deve conter exatamente 6 dígitos numéricos.');
      return;
    }

    setLoading(true);
    try {
      const activeUser = SessionService.getActiveUserEmail();
      if (activeUser) {
        const res = await login2FA(totpToken);
        setLoading(false);
        if (res.success) {
          setSuccessMsg('Código verificado com sucesso! Acesso liberado.');
        } else {
          setErrorMsg('Código 2FA incorreto ou expirado. Verifique o relógio do aparelho.');
        }
      } else {
        setLoading(false);
        setErrorMsg('Sessão expirada. Por favor, reinicie o login.');
      }
    } catch (err: unknown) {
      setLoading(false);
      setErrorMsg(getErrorMessage(err) || 'Falha ao validar autenticação de dois fatores.');
    }
  };

  if (mode === 'LOADING') {
    return (
      <IonPage>
        <IonContent className="auth-lightweight-page">
          <div className="auth-loading-state" role="status" aria-label="Carregando cofre seguro">
            <div className="auth-shield-loader">
              <ShieldCheck className="w-10 h-10 text-cyan-400 animate-pulse" />
            </div>
            <IonSpinner name="crescent" style={{ color: '#60a5fa', width: '32px', height: '32px' }} />
            <span className="text-slate-400 text-sm font-medium">Iniciando Ambiente Criptográfico...</span>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent className="auth-lightweight-page">
        {/* Fundo Puro em CSS: Grid sutil e gradientes estáticos ultra-leves (Zero WebGL/Canvas) */}
        <div className="cyber-ambient-bg" aria-hidden="true">
          <div className="ambient-glow-top" />
          <div className="ambient-glow-bottom" />
          <div className="cyber-grid-overlay" />
        </div>

        <div className="auth-screen-container">
          <main className="auth-saas-card" aria-labelledby="auth-brand-heading">
            
            {/* Header da Marca com Emblema de Segurança */}
            <header className="auth-brand-header">
              <div className="shield-emblem-wrapper" aria-hidden="true">
                <div className="shield-orbital-ring" />
                <div className="shield-emblem-icon">
                  <ShieldCheck className="w-8 h-8 text-cyan-400" strokeWidth={2.2} />
                </div>
              </div>

              <h1 id="auth-brand-heading" className="brand-title">
                Risk<span className="brand-title-accent">Zero</span>
              </h1>
              
              <p className="brand-tagline">Defesa Cibernética &amp; Cofre Digital</p>
              
              <div className="brand-zk-pill">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Criptografia de Conhecimento Zero</span>
              </div>
            </header>

            {/* Alternador de Abas (Entrar / Criar Conta) */}
            {mode !== 'TOTP_VERIFY' && (
              <nav className="auth-segmented-tabs" role="tablist" aria-label="Modo de autenticação">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'LOGIN'}
                  className={`tab-toggle-btn ${mode === 'LOGIN' ? 'active' : ''}`}
                  onClick={() => switchTab('LOGIN')}
                >
                  Entrar
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

            {/* Mensagens de Alerta (Acessíveis) */}
            {errorMsg && (
              <div className="auth-feedback-alert error" role="alert">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="auth-feedback-alert success" role="status">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* ==================================================== */}
            {/* FORMULÁRIO 1: LOGIN                                 */}
            {/* ==================================================== */}
            {mode === 'LOGIN' && (
              <form onSubmit={handleLogin} className="auth-form-body" noValidate>
                <div className="form-field-group">
                  <label htmlFor="login-email" className="field-label">
                    E-mail ou Usuário
                  </label>
                  <div className="field-input-wrapper">
                    <input
                      id="login-email"
                      type="text"
                      inputMode="email"
                      autoComplete="username"
                      placeholder="Ex: seuemail@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading || lockoutSecs > 0}
                      required
                      className="clean-text-input"
                    />
                  </div>
                </div>

                <div className="form-field-group">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-password" className="field-label">
                      Senha Mestra
                    </label>
                    <button
                      type="button"
                      onClick={handleBiometricRecovery}
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium focus:outline-none"
                    >
                      Recuperar via biometria
                    </button>
                  </div>
                  <div className="field-input-wrapper">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Digite sua senha mestra"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading || lockoutSecs > 0}
                      required
                      className="clean-text-input pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                      onClick={() => setShowPassword(!showPassword)}
                      className="field-adornment-btn"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-slate-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Opção configurável: Manter conectado ao atualizar a página (F5) */}
                <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-slate-900/60 border border-white/5 my-2">
                  <div className="flex items-center gap-2.5">
                    <input
                      id="remember-session-check"
                      type="checkbox"
                      checked={rememberSession}
                      onChange={(e) => setRememberSession(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-700 focus:ring-cyan-500 cursor-pointer"
                    />
                    <label htmlFor="remember-session-check" className="text-xs text-slate-300 font-medium cursor-pointer select-none">
                      Manter conectado ao atualizar (F5)
                    </label>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    rememberSession 
                      ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400' 
                      : 'bg-slate-900 border-white/10 text-slate-400'
                  }`}>
                    {rememberSession ? 'Lembrar Ativo' : 'Desativado'}
                  </span>
                </div>

                {lockoutSecs > 0 ? (
                  <div className="lockout-warning-card" role="alert">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                    <div>
                      <h3 className="text-sm font-semibold text-rose-300">Defesa por Força Bruta Ativa</h3>
                      <p className="text-xs text-rose-200/80 mt-0.5">
                        Tentativas excedidas. Aguarde <strong>{lockoutSecs}s</strong> antes de tentar novamente.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="submit"
                      disabled={loading}
                      className="primary-action-btn mt-2"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <IonSpinner name="crescent" style={{ width: '20px', height: '20px' }} />
                          <span>Desbloqueando cofre...</span>
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <Lock className="w-4 h-4" />
                          <span>Desbloquear Cofre</span>
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleBiometricLogin}
                      disabled={loading}
                      className="secondary-biometric-btn mt-3"
                    >
                      <Fingerprint className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Desbloquear com Biometria</span>
                    </button>
                  </>
                )}
              </form>
            )}

            {/* ==================================================== */}
            {/* FORMULÁRIO 2: CADASTRO                              */}
            {/* ==================================================== */}
            {mode === 'REGISTER' && (
              <form onSubmit={handleRegister} className="auth-form-body" noValidate>
                <div className="form-field-group">
                  <label htmlFor="reg-email" className="field-label">
                    E-mail ou Identificador
                  </label>
                  <div className="field-input-wrapper">
                    <input
                      id="reg-email"
                      type="text"
                      inputMode="email"
                      autoComplete="username"
                      placeholder="Ex: aluno@seguranca.com"
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
                    Criar Senha Mestra
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
                      aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                      onClick={() => setShowPassword(!showPassword)}
                      className="field-adornment-btn"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-slate-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Medidor e Requisitos em Tempo Real */}
                <div className="password-health-container" aria-live="polite">
                  <div className="strength-meter-header">
                    <span className="text-xs text-slate-400 font-medium">Força da Senha</span>
                    <span 
                      className="text-xs font-semibold"
                      style={{ color: password.length === 0 ? '#64748b' : strengthColors[Math.max(0, strengthScore - 1)] }}
                    >
                      {password.length === 0 ? 'Não informada' : strengthLabels[Math.max(0, strengthScore - 1)]}
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
                              : 'rgba(255, 255, 255, 0.08)'
                        }}
                      />
                    ))}
                  </div>

                  <div className="requirements-checklist">
                    <div className={`check-rule ${pwdReqs.length ? 'met' : ''}`}>
                      {pwdReqs.length ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      )}
                      <span>Pelo menos 12 caracteres</span>
                    </div>

                    <div className={`check-rule ${pwdReqs.upper ? 'met' : ''}`}>
                      {pwdReqs.upper ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      )}
                      <span>Letra maiúscula (A-Z)</span>
                    </div>

                    <div className={`check-rule ${pwdReqs.lower ? 'met' : ''}`}>
                      {pwdReqs.lower ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      )}
                      <span>Letra minúscula (a-z)</span>
                    </div>

                    <div className={`check-rule ${pwdReqs.number ? 'met' : ''}`}>
                      {pwdReqs.number ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      )}
                      <span>Número (0-9)</span>
                    </div>

                    <div className={`check-rule ${pwdReqs.special ? 'met' : ''}`}>
                      {pwdReqs.special ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      )}
                      <span>Caractere especial (!@#$...)</span>
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
                      placeholder="Repita a senha mestra criada"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      required
                      className="clean-text-input"
                    />
                  </div>
                </div>

                {/* Aviso Institucional de Soberania de Dados (Zero-Knowledge) */}
                <div className="security-notice-box">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-300/90 leading-relaxed">
                    <strong>Aviso de Segurança:</strong> Sua Senha Mestra é a chave de decodificação exclusiva do cofre e nunca sai do aparelho. Por segurança, ela é <strong>irrecuperável</strong> caso perdida.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!isPasswordValid() || loading}
                  className="primary-action-btn mt-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <IonSpinner name="crescent" style={{ width: '20px', height: '20px' }} />
                      <span>Gerando chaves criptográficas...</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span>Criar Meu Cofre Seguro</span>
                    </span>
                  )}
                </button>
              </form>
            )}

            {/* ==================================================== */}
            {/* FORMULÁRIO 3: 2FA TOTP VERIFICATION                 */}
            {/* ==================================================== */}
            {mode === 'TOTP_VERIFY' && (
              <form onSubmit={handleVerify2FA} className="auth-form-body" noValidate>
                <div className="totp-badge-icon-box">
                  <KeyRound className="w-8 h-8 text-cyan-400" />
                </div>

                <div className="text-center mb-4">
                  <h2 className="text-lg font-bold text-white">Verificação em Duas Etapas (2FA)</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Digite o código de 6 dígitos gerado no seu aplicativo autenticador.
                  </p>
                </div>

                <div className="form-field-group">
                  <label htmlFor="totp-input" className="field-label text-center block">
                    Código de Segurança
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
                      className="clean-text-input text-center text-xl font-bold tracking-[6px]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || totpToken.length !== 6}
                  className="primary-action-btn mt-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <IonSpinner name="crescent" style={{ width: '20px', height: '20px' }} />
                      <span>Validando token...</span>
                    </span>
                  ) : (
                    <span>Confirmar Código</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('LOGIN');
                    setTotpToken('');
                    setErrorMsg(null);
                  }}
                  className="w-full text-center text-xs text-slate-400 hover:text-white transition-colors py-2.5 mt-2"
                >
                  Voltar para tela de login
                </button>
              </form>
            )}

            {/* Rodapé institucional com versão e conformidade */}
            <footer className="auth-card-footer">
              <span>Segurança Defensiva e Proteção de Dados • LGPD Compliant</span>
            </footer>

          </main>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AuthPage;
