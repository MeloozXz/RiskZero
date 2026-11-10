import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonPage, IonContent } from '@ionic/react';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  KeyRound,
  Lock,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Hash,
  Database,
} from 'lucide-react';
import {
  DataBreachService,
  EmailBreachResult,
  PasswordBreachResult,
} from '../../services/breach';
import { SessionService } from '../../services/session';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { OrbitRing, OrbitTone } from '../../components/brand';
import './BreachPage.css';

export const BreachPage: React.FC = () => {
  const history = useHistory();
  const currentEmail = SessionService.getActiveUserEmail() || '';

  const [inputEmail, setInputEmail] = useState<string>(currentEmail);
  const [testPassword, setTestPassword] = useState<string>('');

  const [loadingEmail, setLoadingEmail] = useState<boolean>(false);
  const [loadingPwd, setLoadingPwd] = useState<boolean>(false);

  const [emailResult, setEmailResult] = useState<EmailBreachResult | null>(null);
  const [pwdResult, setPwdResult] = useState<PasswordBreachResult | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleCheckEmail = async (e?: React.FormEvent, overrideEmail?: string) => {
    if (e) e.preventDefault();
    const target = (overrideEmail ?? inputEmail).trim();
    if (!target) return;

    setLoadingEmail(true);
    setEmailError(null);
    setEmailResult(null);
    try {
      const res = await DataBreachService.checkEmailBreach(target);
      setEmailResult(res);
    } catch (err: unknown) {
      console.error(err);
      setEmailError(
        err instanceof Error ? err.message : 'Erro ao realizar a auditoria do e-mail.'
      );
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleCheckPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!testPassword) return;

    setLoadingPwd(true);
    try {
      const res = await DataBreachService.checkPasswordBreach(testPassword);
      setPwdResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPwd(false);
    }
  };

  const isScanning = loadingEmail || loadingPwd;

  // Cálculo da postura global de vazamentos para o OrbitRing
  let postureScore = 100;
  let postureTone: OrbitTone = 'accent';
  let postureStatusLabel = 'Pronto para Auditoria';

  if (isScanning) {
    postureTone = 'accent';
    postureStatusLabel = 'Varrendo Bases HIBP...';
  } else if (emailResult || pwdResult) {
    const emailPenalty = emailResult?.isBreached ? Math.max(35, emailResult.riskScore) : 0;
    const pwdPenalty = pwdResult?.breached ? 55 : 0;
    postureScore = Math.max(0, 100 - Math.max(emailPenalty, pwdPenalty));

    if (emailResult?.isBreached || pwdResult?.breached) {
      postureTone = postureScore < 50 ? 'danger' : 'warning';
      postureStatusLabel = 'Exposição Detectada';
    } else {
      postureTone = 'success';
      postureStatusLabel = 'Zero Vazamentos Detectados';
    }
  }

  return (
    <IonPage className="rz-page">
      <IonContent className="rz-content" fullscreen>
        <div className="rz-page-container">
          <PageHeader
            eyebrow="Auditoria k-Anonymity"
            title="Vazamentos de Credenciais"
            subtitle="Verifique se o seu endereço de e-mail ou senhas foram expostos em incidentes públicos utilizando truncamento SHA-1 Zero-Knowledge."
            actions={
              <button
                type="button"
                className="rz-btn rz-btn-secondary"
                onClick={() => history.push('/vault')}
              >
                <Lock size={15} />
                <span>Ir para Meu Cofre Atualizar Senhas</span>
                <ArrowRight size={15} />
              </button>
            }
          />

          {/* Painel Hero: Postura de Vazamentos com OrbitRing */}
          <section
            className="rz-panel rz-meridian-bg breach-posture-hero"
            aria-label="Postura de exposição de credenciais"
          >
            <div className="breach-posture-left">
              <OrbitRing
                size={118}
                stroke={6}
                spinning={isScanning}
                value={isScanning ? undefined : postureScore}
                tone={postureTone}
                globe
                label={postureStatusLabel}
              >
                {isScanning ? (
                  <span
                    className="rz-font-mono"
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: 'var(--rz-ice)',
                      textTransform: 'uppercase',
                    }}
                  >
                    SHA-1
                  </span>
                ) : (
                  <>
                    <span
                      className="rz-num"
                      style={{
                        fontSize: '1.85rem',
                        fontWeight: 800,
                        lineHeight: 1,
                        color: 'var(--rz-text-primary)',
                      }}
                    >
                      {postureScore}%
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--rz-text-muted)',
                        marginTop: 2,
                      }}
                    >
                      Integridade
                    </span>
                  </>
                )}
              </OrbitRing>

              <div className="breach-posture-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    className={`rz-badge ${
                      isScanning
                        ? 'rz-badge-blue'
                        : postureTone === 'success'
                          ? 'rz-badge-success'
                          : postureTone === 'danger' || postureTone === 'warning'
                            ? 'rz-badge-danger'
                            : 'rz-badge-blue'
                    }`}
                  >
                    <span
                      className={`rz-dot ${
                        isScanning
                          ? 'info is-live'
                          : postureTone === 'success'
                            ? 'success'
                            : postureTone === 'danger' || postureTone === 'warning'
                              ? 'danger'
                              : 'info'
                      }`}
                    />
                    {postureStatusLabel}
                  </span>
                  <span className="rz-badge rz-badge-neutral rz-font-mono">
                    Protocolo HIBP k-Anonymity
                  </span>
                </div>

                <h2 className="breach-posture-title">Detector de Credenciais Comprometidas</h2>
                <p className="rz-text-muted" style={{ maxWidth: '64ch' }}>
                  Consultas de senha transmitem apenas os <strong>5 primeiros caracteres</strong> do hash SHA-1 para a API do Have I Been Pwned, garantindo que sua senha real jamais saia do dispositivo.
                </p>
              </div>
            </div>
          </section>

          <div className="breach-grid">
            {/* ==================== SEÇÃO 1: VERIFICAÇÃO DE E-MAIL ==================== */}
            <section className="rz-panel">
              <div className="rz-card-header">
                <div className="rz-card-title-group">
                  <div className="rz-icon-tile">
                    <Mail />
                  </div>
                  <div>
                    <h2 className="rz-card-title">1. Consultar Endereço de E-mail</h2>
                    <p className="rz-text-muted">
                      Varredura em bases catalogadas de vazamentos corporativos.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={(e) => handleCheckEmail(e)}>
                <div className="rz-field">
                  <label htmlFor="breach-email-input" className="rz-label">
                    ENDEREÇO DE E-MAIL
                  </label>
                  <div className="rz-input-group">
                    <Search size={17} />
                    <input
                      id="breach-email-input"
                      type="email"
                      className="rz-input is-mono"
                      placeholder="Digite seu e-mail (Ex: usuario@exemplo.com)"
                      value={inputEmail}
                      onChange={(e) => setInputEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="rz-btn rz-btn-primary rz-btn-lg rz-btn-block"
                  disabled={loadingEmail || !inputEmail.trim()}
                  data-loading={loadingEmail ? 'true' : undefined}
                >
                  <Search size={16} />
                  <span>
                    {loadingEmail
                      ? 'Auditando bases de vazamento...'
                      : 'Verificar Segurança do E-mail'}
                  </span>
                </button>
              </form>

              {/* Chips rápidos para simulação imediata */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: '1px solid var(--rz-border-subtle)',
                }}
              >
                <span className="rz-help">Testar cenários:</span>
                <button
                  type="button"
                  className="rz-chip"
                  style={{ height: 28, fontSize: 'var(--rz-text-xs)' }}
                  onClick={() => {
                    const cleanSample = 'cofre.seguro@riskzero.app';
                    setInputEmail(cleanSample);
                    handleCheckEmail(undefined, cleanSample);
                  }}
                >
                  <ShieldCheck size={13} style={{ color: 'var(--rz-success)' }} />
                  <span>Conta Limpa</span>
                </button>
                <button
                  type="button"
                  className="rz-chip"
                  style={{ height: 28, fontSize: 'var(--rz-text-xs)' }}
                  onClick={() => {
                    const breachedSample = 'admin.vazado@exemplo.com';
                    setInputEmail(breachedSample);
                    handleCheckEmail(undefined, breachedSample);
                  }}
                >
                  <ShieldAlert size={13} style={{ color: 'var(--rz-danger)' }} />
                  <span>Simular Exposição</span>
                </button>
              </div>

              {/* Mensagem de Erro na Auditoria */}
              {emailError && (
                <div className="rz-alert rz-alert-danger" style={{ marginTop: 16 }}>
                  <AlertTriangle size={18} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Falha na Auditoria</div>
                    <div>{emailError}</div>
                    {emailError.includes('Configurações') && (
                      <button
                        type="button"
                        onClick={() => history.push('/settings')}
                        className="rz-btn rz-btn-secondary rz-btn-sm"
                        style={{ marginTop: 8 }}
                      >
                        <span>Abrir Configurações</span>
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Resultado da Busca de E-mail */}
              {emailResult && (
                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 18,
                    borderTop: '1px solid var(--rz-border)',
                  }}
                >
                  {emailResult.isBreached ? (
                    <div>
                      <div className="rz-alert rz-alert-danger" style={{ marginBottom: 14 }}>
                        <ShieldAlert size={18} />
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 8,
                              marginBottom: 4,
                            }}
                          >
                            <strong>
                              E-mail encontrado em {emailResult.totalBreaches} vazamentos!
                            </strong>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <span
                                className={`rz-badge ${
                                  emailResult.isSimulated ? 'rz-badge-warning' : 'rz-badge-success'
                                }`}
                              >
                                {emailResult.isSimulated ? 'Simulação' : 'HIBP v3 Oficial'}
                              </span>
                              <span className="rz-badge rz-badge-danger rz-font-mono">
                                Risco {emailResult.riskScore}%
                              </span>
                            </div>
                          </div>
                          <span>
                            Recomendamos trocar a senha das contas listadas abaixo imediatamente no seu cofre.
                          </span>
                        </div>
                      </div>

                      <div className="breach-incident-list">
                        {emailResult.breaches.map((b) => (
                          <div key={b.id} className="breach-incident-item">
                            <div className="breach-incident-head">
                              <h3 className="breach-incident-name">{b.name}</h3>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span
                                  className={`rz-badge ${
                                    b.severity === 'CRÍTICA'
                                      ? 'rz-badge-danger'
                                      : 'rz-badge-warning'
                                  }`}
                                >
                                  {b.severity}
                                </span>
                                <span className="rz-help rz-font-mono">{b.breachDate}</span>
                              </div>
                            </div>
                            <p className="rz-text-muted">{b.description}</p>
                            <div className="breach-tags">
                              {b.dataClasses.map((item, idx) => (
                                <span key={idx} className="rz-badge rz-badge-danger">
                                  <Database size={11} />
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      mascot
                      mascotHeight={175}
                      title="Nenhuma Credencial Exposta"
                      description={
                        <>
                          Nenhum vazamento encontrado! Seu e-mail{' '}
                          <strong className="rz-font-mono">{emailResult.email}</strong> não foi
                          detectado nas bases de dados expostas catalogadas (
                          {emailResult.isSimulated ? 'Simulação' : 'HIBP v3 Oficial'}).
                        </>
                      }
                      action={
                        <span
                          className={`rz-badge ${
                            emailResult.isSimulated ? 'rz-badge-warning' : 'rz-badge-success'
                          }`}
                        >
                          <CheckCircle2 size={12} />
                          {emailResult.isSimulated ? 'Auditoria Local Simulada' : 'Verificado HIBP v3'}
                        </span>
                      }
                    />
                  )}
                </div>
              )}
            </section>

            {/* ==================== SEÇÃO 2: TESTE DE SENHA K-ANONYMITY ==================== */}
            <section className="rz-panel">
              <div className="rz-card-header">
                <div className="rz-card-title-group">
                  <div className="rz-icon-tile violet">
                    <KeyRound />
                  </div>
                  <div>
                    <h2 className="rz-card-title">
                      2. Teste de Senha Anonimizado (k-Anonymity)
                    </h2>
                    <p className="rz-text-muted">
                      Sua senha nunca é enviada completa — apenas os 5 primeiros caracteres do hash SHA-1.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleCheckPassword}>
                <div className="rz-field">
                  <label htmlFor="breach-pwd-input" className="rz-label">
                    SENHA PARA AUDITORIA ZERO-KNOWLEDGE
                  </label>
                  <div className="rz-input-group">
                    <Hash size={17} />
                    <input
                      id="breach-pwd-input"
                      type="password"
                      className="rz-input is-mono"
                      placeholder="Digite uma senha para testar se é conhecida por hackers"
                      value={testPassword}
                      onChange={(e) => setTestPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="rz-btn rz-btn-primary rz-btn-lg rz-btn-block"
                  disabled={loadingPwd || !testPassword}
                  data-loading={loadingPwd ? 'true' : undefined}
                >
                  <KeyRound size={16} />
                  <span>
                    {loadingPwd ? 'Consultando HIBP SHA-1...' : 'Auditar Senha (Zero-Knowledge)'}
                  </span>
                </button>
              </form>

              <div
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: '1px solid var(--rz-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span className="rz-help">
                  Privacidade matemática: <code className="rz-font-mono">SHA1(senha)[0..5]</code>
                </span>
                <span className="rz-badge rz-badge-blue rz-font-mono">Add-Padding: true</span>
              </div>

              {/* Resultado da Busca de Senha */}
              {pwdResult && (
                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 18,
                    borderTop: '1px solid var(--rz-border)',
                  }}
                >
                  {pwdResult.breached ? (
                    <div className="rz-alert rz-alert-warning">
                      <AlertTriangle size={18} />
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginBottom: 4,
                          }}
                        >
                          <strong>Atenção: Senha Comprometida!</strong>
                          {pwdResult.sha1Prefix && (
                            <span className="rz-badge rz-badge-warning rz-font-mono">
                              Prefixo SHA-1: {pwdResult.sha1Prefix}***
                            </span>
                          )}
                        </div>
                        <p style={{ margin: 0 }}>
                          Esta senha já apareceu{' '}
                          <strong className="rz-font-mono">
                            {pwdResult.count.toLocaleString()} vezes
                          </strong>{' '}
                          em vazamentos de dados públicos. <strong>Não a utilize!</strong>
                        </p>
                      </div>
                    </div>
                  ) : !emailResult ? (
                    <EmptyState
                      mascot
                      mascotHeight={175}
                      title="Nenhuma Credencial Exposta"
                      description={
                        <>
                          Senha Segura e Exclusiva! Nenhum registro desta senha foi encontrado na base global do HaveIBeenPwned
                          {pwdResult.sha1Prefix ? ` (Prefixo SHA-1: ${pwdResult.sha1Prefix}***)` : ''}.
                        </>
                      }
                    />
                  ) : (
                    <div className="rz-alert rz-alert-success">
                      <CheckCircle2 size={18} />
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginBottom: 4,
                          }}
                        >
                          <strong>Senha Segura e Exclusiva</strong>
                          {pwdResult.sha1Prefix && (
                            <span className="rz-badge rz-badge-success rz-font-mono">
                              Prefixo SHA-1: {pwdResult.sha1Prefix}***
                            </span>
                          )}
                        </div>
                        <p style={{ margin: 0 }}>
                          Nenhum registro desta senha foi encontrado na base global do HaveIBeenPwned.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};
