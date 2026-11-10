import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonContent,
  IonPage,
  IonToast,
} from '@ionic/react';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  Fingerprint,
  AlertTriangle,
  Activity,
  Globe,
  Wifi,
  Sliders,
  BookOpen,
  Download,
  RefreshCw,
  Copy,
  CheckCircle2,
  ArrowUpRight,
  Plus,
  X,
  ChevronRight,
} from 'lucide-react';
import { useSecurity } from '../contexts/SecurityContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useVault } from '../contexts/VaultContext';
import { PageHeader } from '../components/ui/PageHeader';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Mascot, OrbitRing, OrbitTone } from '../components/brand';
import { StorageService } from '../services/storage';
import { SessionService } from '../services/session';
import { VpnService, VpnStats } from '../services/vpn';
import { AuditLog } from '../types';
import { getErrorMessage } from '../lib/utils';
import './Home.css';

const WELCOME_STORAGE_KEY = 'rz_welcome_dismissed';

const Home: React.FC = () => {
  const history = useHistory();
  const {
    lockApp,
    hasPIN,
    registerPIN,
    totpEnabled,
    setupNew2FA,
    enable2FA,
    disable2FA,
    activeEmail,
    vaultHealth,
    runVaultHealthCheck,
    isBiometricEnabled,
  } = useSecurity();
  const { isPro, isUltra } = useSubscription();
  const { items, healthStats } = useVault();

  const [welcomeDismissed, setWelcomeDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WELCOME_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [vpnStats, setVpnStats] = useState<VpnStats>(() => VpnService.getStats());

  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [show2FASetup, setShow2FASetup] = useState<boolean>(false);
  const [totpTokenInput, setTotpTokenInput] = useState<string>('');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [currentLocalSecret, setCurrentLocalSecret] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [isExportingCSV, setIsExportingCSV] = useState<boolean>(false);
  const [showDisable2FAConfirm, setShowDisable2FAConfirm] = useState<boolean>(false);

  const loadLogs = async () => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    const logs = await StorageService.getAuditLogs(email);
    setAuditLogs(logs);
  };

  useEffect(() => {
    loadLogs();
    const unsubVpn = VpnService.subscribe((stats) => setVpnStats(stats));
    const handleFocus = () => {
      loadLogs();
      runVaultHealthCheck();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      unsubVpn();
      window.removeEventListener('focus', handleFocus);
    };
  }, [runVaultHealthCheck]);

  const handleDismissWelcome = () => {
    try {
      localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
    } catch {
      // Ignora caso storage esteja restrito
    }
    setWelcomeDismissed(true);
  };

  const handleSavePIN = async () => {
    setPinError(null);
    if (pinInput.length !== 6 || isNaN(Number(pinInput))) {
      setPinError('O PIN deve conter exatamente 6 dígitos numéricos.');
      return;
    }
    try {
      await registerPIN(pinInput);
      setPinInput('');
      await loadLogs();
      setToastMsg('PIN de desbloqueio rápido configurado.');
      setShowToast(true);
    } catch (e: unknown) {
      setPinError(getErrorMessage(e) || 'Erro ao salvar PIN.');
    }
  };

  const handleStart2FA = () => {
    setMfaError(null);
    const secret = setupNew2FA();
    setCurrentLocalSecret(secret);
    setShow2FASetup(true);
  };

  const handleCopySecret = async (secret: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(secret);
      }
      setToastMsg('Segredo Base32 copiado.');
      setShowToast(true);
    } catch {
      setToastMsg('Segredo selecionado.');
      setShowToast(true);
    }
  };

  const handleConfirm2FA = async () => {
    setMfaError(null);
    const res = await enable2FA(totpTokenInput);
    if (res.success) {
      setTotpTokenInput('');
      setCurrentLocalSecret(null);
      setShow2FASetup(false);
      await loadLogs();
      setToastMsg('Autenticação em duas etapas (2FA TOTP) ativada.');
      setShowToast(true);
    } else {
      setMfaError(res.error || 'Código TOTP inválido.');
    }
  };

  const handleDisable2FA = () => {
    setShowDisable2FAConfirm(true);
  };

  const handleConfirmDisable2FA = async () => {
    setShowDisable2FAConfirm(false);
    await disable2FA();
    setCurrentLocalSecret(null);
    setShow2FASetup(false);
    await loadLogs();
    setToastMsg('Autenticação 2FA desativada.');
    setShowToast(true);
  };

  const handleExportAuditCSV = async () => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    setIsExportingCSV(true);
    try {
      const csv = await StorageService.exportAuditLogsCSV(email);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_riskzero_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToastMsg('Relatório de auditoria CSV (RFC 4180 / LGPD) exportado.');
      setShowToast(true);
    } catch {
      setToastMsg('Erro ao exportar auditoria.');
      setShowToast(true);
    } finally {
      setIsExportingCSV(false);
    }
  };

  const securityScore = vaultHealth ? vaultHealth.score : 100;
  const totalCreds = healthStats ? healthStats.total : items.length;
  const weakOrReused = vaultHealth
    ? vaultHealth.weak + vaultHealth.reused
    : healthStats
      ? healthStats.weak + healthStats.reused
      : 0;
  const breachedCount = vaultHealth ? vaultHealth.breached : 0;

  const scoreTone: OrbitTone =
    securityScore >= 80 ? 'success' : securityScore >= 50 ? 'warning' : 'danger';

  const vpnConnected = vpnStats.status === 'CONNECTED';
  const deviceShielded = hasPIN && (totpEnabled || isBiometricEnabled);
  const recentCredentials = items.slice(0, 5);

  return (
    <IonPage className="home-page">
      <IonContent fullscreen className="home-content">
        <div className="rz-page-container">
          <PageHeader
            eyebrow="Centro de Comando"
            title="Postura de Segurança"
            subtitle={
              <>
                Sessão criptografada ativa para{' '}
                <strong style={{ color: 'var(--rz-text-primary)' }}>
                  {activeEmail || 'usuário local'}
                </strong>{' '}
                · Envelope AES-256-GCM + Argon2id ·{' '}
                <span className={`rz-badge ${isUltra || isPro ? 'rz-badge-violet' : 'rz-badge-blue'}`} style={{ verticalAlign: 'middle' }}>
                  Plano {isUltra ? 'Ultra' : isPro ? 'Pro' : 'Essencial'}
                </span>
              </>
            }
            actions={
              <>
                <button
                  type="button"
                  className="rz-btn rz-btn-secondary"
                  onClick={() => {
                    runVaultHealthCheck();
                    loadLogs();
                    setToastMsg('Telemetria atualizada.');
                    setShowToast(true);
                  }}
                >
                  <RefreshCw size={15} />
                  <span>Atualizar</span>
                </button>

                <button
                  type="button"
                  className="rz-btn rz-btn-primary"
                  onClick={lockApp}
                >
                  <Lock size={15} />
                  <span>Bloquear Cofre</span>
                </button>
              </>
            }
          />

          {/* Banner Orbital Dispensável com Mascote */}
          {!welcomeDismissed && (
            <section className="home-welcome-banner rz-meridian-bg" aria-label="Boas-vindas ao RiskZero">
              <button
                type="button"
                className="rz-icon-btn home-welcome-dismiss"
                onClick={handleDismissWelcome}
                aria-label="Dispensar boas-vindas"
                title="Dispensar"
              >
                <X size={16} />
              </button>

              <div className="home-welcome-left">
                <div className="home-welcome-mascot-wrap">
                  <Mascot height={115} />
                </div>

                <div className="home-welcome-copy">
                  <span className="rz-eyebrow" style={{ marginBottom: 2 }}>
                    Arquitetura Zero-Knowledge Ativa
                  </span>
                  <h2 className="home-welcome-title">
                    {totalCreds === 0
                      ? 'Seu cofre blindado está pronto para a primeira credencial'
                      : 'Postura orbital monitorada em tempo real'}
                  </h2>
                  <p className="home-welcome-text">
                    Suas chaves derivadas por Argon2id permanecem exclusivamente na memória volátil (RAM).
                    Nenhum dado em texto claro deixa o seu dispositivo.
                  </p>
                  <div className="home-welcome-actions">
                    <button
                      type="button"
                      className="rz-btn rz-btn-primary rz-btn-sm"
                      onClick={() => history.push('/vault/add')}
                    >
                      <Plus size={14} />
                      <span>Adicionar Credencial</span>
                    </button>
                    <button
                      type="button"
                      className="rz-btn rz-btn-secondary rz-btn-sm"
                      onClick={() => history.push('/education')}
                    >
                      <BookOpen size={14} />
                      <span>Guia Zero-Knowledge & LGPD</span>
                    </button>
                    <button
                      type="button"
                      className="rz-btn rz-btn-ghost rz-btn-sm"
                      onClick={handleDismissWelcome}
                    >
                      <span>Dispensar aviso</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Layout de 2 Colunas no Desktop (≥1280px) */}
          <div className="rz-split">
            {/* Coluna Principal */}
            <div>
              {/* 1. Security Score Hero Panel */}
              <section className="rz-panel rz-panel-accent rz-meridian-bg home-hero-panel" aria-label="Índice de Postura de Segurança">
                <div className="home-score-stage">
                  <OrbitRing
                    value={securityScore}
                    size={136}
                    stroke={8}
                    tone={scoreTone}
                    label="Índice de Postura de Segurança"
                  >
                    <span className="rz-num home-score-value">{securityScore}%</span>
                    <span className="home-score-unit">SCORE ORBITAL</span>
                  </OrbitRing>
                  <span className={`rz-badge ${securityScore >= 80 ? 'rz-badge-success' : securityScore >= 50 ? 'rz-badge-warning' : 'rz-badge-danger'}`}>
                    {securityScore >= 80 ? 'Blindagem Elevada' : securityScore >= 50 ? 'Atenção Requerida' : 'Risco Crítico'}
                  </span>
                </div>

                <div className="home-posture-body">
                  <div className="home-posture-head">
                    <div>
                      <h2 className="home-posture-title">Diagnóstico de Postura Criptográfica</h2>
                      <p className="home-posture-sub">
                        Indicadores operacionais da sessão local, higiene de senhas e superfície do aparelho.
                      </p>
                    </div>
                  </div>

                  <div className="home-posture-grid">
                    <button
                      type="button"
                      className="home-posture-item"
                      onClick={() => history.push('/vault')}
                    >
                      <span className="rz-icon-tile success">
                        <Lock />
                      </span>
                      <span className="home-posture-item-info">
                        <span className="home-posture-item-label">Cofre AES-256</span>
                        <span className="home-posture-item-status">
                          Ativo · {totalCreds} registro(s)
                        </span>
                      </span>
                      <ChevronRight size={16} style={{ color: 'var(--rz-text-muted)' }} />
                    </button>

                    <button
                      type="button"
                      className="home-posture-item"
                      onClick={() => history.push('/vpn')}
                    >
                      <span className={`rz-icon-tile ${vpnConnected ? 'success' : 'neutral'}`}>
                        <Wifi />
                      </span>
                      <span className="home-posture-item-info">
                        <span className="home-posture-item-label">Status VPN</span>
                        <span className="home-posture-item-status">
                          {vpnConnected ? `Conectado · ${vpnStats.selectedServer.country}` : 'Túnel em espera'}
                        </span>
                      </span>
                      <ChevronRight size={16} style={{ color: 'var(--rz-text-muted)' }} />
                    </button>

                    <button
                      type="button"
                      className="home-posture-item"
                      onClick={() => history.push('/analysis')}
                    >
                      <span className={`rz-icon-tile ${weakOrReused > 0 ? 'warning' : 'success'}`}>
                        <Activity />
                      </span>
                      <span className="home-posture-item-info">
                        <span className="home-posture-item-label">Senhas Fracas / Reutilizadas</span>
                        <span className="home-posture-item-status">
                          {weakOrReused > 0 ? `${weakOrReused} requer(em) rotação` : '100% alta entropia'}
                        </span>
                      </span>
                      <ChevronRight size={16} style={{ color: 'var(--rz-text-muted)' }} />
                    </button>

                    <button
                      type="button"
                      className="home-posture-item"
                      onClick={() => history.push('/hardening')}
                    >
                      <span className={`rz-icon-tile ${deviceShielded ? 'success' : 'warning'}`}>
                        <Sliders />
                      </span>
                      <span className="home-posture-item-info">
                        <span className="home-posture-item-label">Blindagem do Aparelho</span>
                        <span className="home-posture-item-status">
                          {deviceShielded ? 'PIN + MFA ativos' : 'Configurar camadas'}
                        </span>
                      </span>
                      <ChevronRight size={16} style={{ color: 'var(--rz-text-muted)' }} />
                    </button>
                  </div>
                </div>
              </section>

              {/* 2. Faixa Dividida de Métricas (.rz-metrics) */}
              <section className="rz-metrics home-metrics-strip" aria-label="Indicadores de segurança">
                <div className="rz-metric">
                  <div className="home-metric-top">
                    <span className="rz-stat-label" style={{ marginBottom: 0 }}>Índice de Postura</span>
                    <ShieldCheck size={15} style={{ color: 'var(--rz-accent-light)' }} />
                  </div>
                  <div
                    className="rz-stat-value rz-num"
                    style={{
                      color:
                        securityScore >= 80
                          ? 'var(--rz-success)'
                          : securityScore >= 50
                            ? 'var(--rz-warning)'
                            : 'var(--rz-danger)',
                    }}
                  >
                    {securityScore}%
                  </div>
                  <div className="home-metric-foot">Cifragem Zero-Knowledge ativa</div>
                </div>

                <button
                  type="button"
                  className="rz-metric home-metric-interactive"
                  onClick={() => history.push('/vault')}
                >
                  <div className="home-metric-top">
                    <span className="rz-stat-label" style={{ marginBottom: 0 }}>Credenciais no Cofre</span>
                    <Lock size={15} style={{ color: 'var(--rz-ice)' }} />
                  </div>
                  <div className="rz-stat-value rz-num">{totalCreds}</div>
                  <div className="home-metric-foot">
                    Gerenciar registros <ArrowUpRight size={12} />
                  </div>
                </button>

                <button
                  type="button"
                  className="rz-metric home-metric-interactive"
                  onClick={() => history.push('/analysis')}
                >
                  <div className="home-metric-top">
                    <span className="rz-stat-label" style={{ marginBottom: 0 }}>Fracas / Repetidas</span>
                    <Activity size={15} style={{ color: 'var(--rz-warning)' }} />
                  </div>
                  <div
                    className="rz-stat-value rz-num"
                    style={{ color: weakOrReused > 0 ? 'var(--rz-warning)' : 'var(--rz-text-primary)' }}
                  >
                    {weakOrReused}
                  </div>
                  <div className="home-metric-foot">
                    Diagnóstico de entropia <ArrowUpRight size={12} />
                  </div>
                </button>

                <button
                  type="button"
                  className="rz-metric home-metric-interactive"
                  onClick={() => history.push('/breach')}
                >
                  <div className="home-metric-top">
                    <span className="rz-stat-label" style={{ marginBottom: 0 }}>Exposições HIBP</span>
                    <AlertTriangle size={15} style={{ color: 'var(--rz-danger)' }} />
                  </div>
                  <div
                    className="rz-stat-value rz-num"
                    style={{ color: breachedCount > 0 ? 'var(--rz-danger)' : 'var(--rz-text-primary)' }}
                  >
                    {breachedCount}
                  </div>
                  <div className="home-metric-foot">
                    Auditoria k-Anonymity <ArrowUpRight size={12} />
                  </div>
                </button>
              </section>

              {/* 3. Matriz de Defesa / Módulos Operacionais */}
              <section className="rz-section">
                <div className="rz-section-head">
                  <h2 className="rz-section-title">
                    Matriz de Defesa & Módulos Operacionais
                    <span className="rz-count">08</span>
                  </h2>
                </div>

                <div className="home-modules-grid">
                  <button type="button" className="home-module-item" onClick={() => history.push('/vault')}>
                    <div className="rz-icon-tile"><Lock /></div>
                    <div className="home-module-text">
                      <strong>Cofre de Credenciais</strong>
                      <span>Senhas, cartões, notas e códigos TOTP</span>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--rz-text-muted)' }} />
                  </button>

                  <button type="button" className="home-module-item" onClick={() => history.push('/biometric-settings')}>
                    <div className={`rz-icon-tile ${isBiometricEnabled ? 'success' : ''}`}><Fingerprint /></div>
                    <div className="home-module-text">
                      <strong>Biometria de Hardware</strong>
                      <span>{isBiometricEnabled ? 'Sensor físico vinculado e ativo' : 'Configurar leitor biométrico nativo'}</span>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--rz-text-muted)' }} />
                  </button>

                  <button type="button" className="home-module-item" onClick={() => history.push('/breach')}>
                    <div className={`rz-icon-tile ${breachedCount > 0 ? 'danger' : ''}`}><AlertTriangle /></div>
                    <div className="home-module-text">
                      <strong>Vazamentos (HIBP)</strong>
                      <span>Verificação SHA-1 k-Anonymity</span>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--rz-text-muted)' }} />
                  </button>

                  <button type="button" className="home-module-item" onClick={() => history.push('/link-detector')}>
                    <div className="rz-icon-tile"><Globe /></div>
                    <div className="home-module-text">
                      <strong>Detector Anti-Phishing</strong>
                      <span>Inspeção heurística de URLs suspeitas</span>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--rz-text-muted)' }} />
                  </button>

                  <button type="button" className="home-module-item" onClick={() => history.push('/vpn')}>
                    <div className={`rz-icon-tile ${vpnConnected ? 'success' : ''}`}><Wifi /></div>
                    <div className="home-module-text">
                      <strong>Rede & VPN</strong>
                      <span>Auditoria de exposição de IP e túnel</span>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--rz-text-muted)' }} />
                  </button>

                  <button type="button" className="home-module-item" onClick={() => history.push('/hardening')}>
                    <div className="rz-icon-tile"><Sliders /></div>
                    <div className="home-module-text">
                      <strong>Blindagem do Dispositivo</strong>
                      <span>Auto-lock, clipboard e privacidade</span>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--rz-text-muted)' }} />
                  </button>

                  <button type="button" className="home-module-item" onClick={() => history.push('/analysis')}>
                    <div className={`rz-icon-tile ${weakOrReused > 0 ? 'warning' : ''}`}><Activity /></div>
                    <div className="home-module-text">
                      <strong>Saúde das Senhas</strong>
                      <span>Análise de força e reutilização</span>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--rz-text-muted)' }} />
                  </button>

                  <button type="button" className="home-module-item" onClick={() => history.push('/education')}>
                    <div className="rz-icon-tile"><BookOpen /></div>
                    <div className="home-module-text">
                      <strong>Base de Conhecimento</strong>
                      <span>Guias práticos e conformidade LGPD</span>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--rz-text-muted)' }} />
                  </button>
                </div>
              </section>

              {/* 4. Controles de Autenticação Rápida (PIN & 2FA) */}
              <section className="home-controls-grid" aria-label="Controles de Autenticação Rápida">
                {/* PIN Local */}
                <div className="rz-card">
                  <div className="rz-card-header">
                    <div className="rz-card-title-group">
                      <span className="rz-icon-tile">
                        <KeyRound />
                      </span>
                      <h3 className="rz-card-title">PIN de Reentrada Rápida</h3>
                    </div>
                    <span className={`rz-badge ${hasPIN ? 'rz-badge-success' : 'rz-badge-warning'}`}>
                      {hasPIN ? 'Ativo' : 'Pendente'}
                    </span>
                  </div>

                  <p className="rz-text-muted" style={{ marginBottom: 14 }}>
                    Permite desbloquear a tela de bloqueio temporário com 6 dígitos numéricos sem redigitar a Senha Mestra completa.
                  </p>

                  <div className="home-pin-form">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Novo PIN (6 dígitos)"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                      className="rz-input is-mono"
                    />
                    <button
                      type="button"
                      onClick={handleSavePIN}
                      disabled={pinInput.length !== 6}
                      className="rz-btn rz-btn-primary"
                    >
                      {hasPIN ? 'Atualizar' : 'Definir PIN'}
                    </button>
                  </div>
                  {pinError && (
                    <p className="rz-field-error" style={{ marginTop: 8, marginBottom: 0 }}>{pinError}</p>
                  )}
                </div>

                {/* 2FA TOTP */}
                <div className="rz-card">
                  <div className="rz-card-header">
                    <div className="rz-card-title-group">
                      <span className="rz-icon-tile">
                        <ShieldCheck />
                      </span>
                      <h3 className="rz-card-title">Segundo Fator (2FA TOTP)</h3>
                    </div>
                    <span className={`rz-badge ${totpEnabled ? 'rz-badge-success' : 'rz-badge-neutral'}`}>
                      {totpEnabled ? 'Ativado' : 'Opcional'}
                    </span>
                  </div>

                  {totpEnabled ? (
                    <div>
                      <p className="rz-text-muted" style={{ marginBottom: 14 }}>
                        Sua conta exige códigos TOTP de 6 dígitos gerados por aplicativo autenticador a cada novo login.
                      </p>
                      <button
                        type="button"
                        onClick={handleDisable2FA}
                        className="rz-btn rz-btn-danger"
                      >
                        Desativar 2FA
                      </button>
                    </div>
                  ) : !show2FASetup ? (
                    <div>
                      <p className="rz-text-muted" style={{ marginBottom: 14 }}>
                        Vincule o Google Authenticator, Authy ou Microsoft Authenticator para exigir verificação em duas etapas.
                      </p>
                      <button
                        type="button"
                        onClick={handleStart2FA}
                        className="rz-btn rz-btn-secondary"
                      >
                        Configurar Autenticador 2FA
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div className="home-2fa-qr-box">
                        {currentLocalSecret && (
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                              `otpauth://totp/RiskZero:${encodeURIComponent(activeEmail || 'usuario')}?secret=${currentLocalSecret}&issuer=RiskZero`
                            )}`}
                            alt="QR Code 2FA"
                            className="home-2fa-qr-img"
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="rz-label">SEGREDO BASE32</div>
                          <code className="home-2fa-secret-code">{currentLocalSecret}</code>
                          <button
                            type="button"
                            className="rz-btn rz-btn-secondary rz-btn-sm"
                            onClick={() => currentLocalSecret && handleCopySecret(currentLocalSecret)}
                          >
                            <Copy size={12} />
                            <span>Copiar chave</span>
                          </button>
                        </div>
                      </div>

                      <div className="home-2fa-verify-row">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Código de 6 dígitos"
                          value={totpTokenInput}
                          onChange={(e) => setTotpTokenInput(e.target.value.replace(/\D/g, ''))}
                          className="rz-input is-mono"
                        />
                        <button
                          type="button"
                          onClick={handleConfirm2FA}
                          disabled={totpTokenInput.length !== 6}
                          className="rz-btn rz-btn-primary"
                        >
                          Ativar
                        </button>
                        <button
                          type="button"
                          onClick={() => setShow2FASetup(false)}
                          className="rz-btn rz-btn-secondary"
                        >
                          Cancelar
                        </button>
                      </div>
                      {mfaError && (
                        <p className="rz-field-error" style={{ margin: 0 }}>{mfaError}</p>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* 5. Trilha de Auditoria LGPD */}
              <section className="rz-card">
                <div className="rz-card-header" style={{ flexWrap: 'wrap' }}>
                  <div>
                    <h3 className="rz-card-title">
                      Trilha de Auditoria Local (LGPD Art. 7º & ISO/IEC 27001)
                    </h3>
                    <p className="rz-text-muted" style={{ marginTop: 2 }}>
                      Registro cronológico de eventos de autenticação, leitura e modificação do cofre.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportAuditCSV}
                    disabled={isExportingCSV || auditLogs.length === 0}
                    className="rz-btn rz-btn-secondary rz-btn-sm"
                  >
                    <Download size={14} />
                    <span>{isExportingCSV ? 'Exportando...' : 'Exportar CSV'}</span>
                  </button>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="home-audit-empty">
                    Nenhum evento de auditoria registrado até o momento.
                  </div>
                ) : (
                  <div className="home-audit-table-wrap">
                    <table className="home-audit-table">
                      <thead>
                        <tr>
                          <th>Evento</th>
                          <th>Descrição</th>
                          <th>Data / Hora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.slice(0, 12).map((log) => {
                          const isOk = log.action.includes('SUCCESS') || log.action.includes('CREATED');
                          const isErr = log.action.includes('FAILED') || log.action.includes('BREACH');
                          return (
                            <tr key={log.id}>
                              <td>
                                <span className={`rz-badge ${isOk ? 'rz-badge-success' : isErr ? 'rz-badge-danger' : 'rz-badge-neutral'}`}>
                                  {isOk && <CheckCircle2 size={11} />}
                                  {log.action}
                                </span>
                              </td>
                              <td className="audit-details-cell">{log.details}</td>
                              <td className="audit-time-cell">
                                {new Date(log.timestamp).toLocaleString('pt-BR')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            {/* Coluna Lateral (Aside Desktop ≥1280px / Empilhada no Mobile) */}
            <aside className="rz-split-aside home-aside-stack" aria-label="Ações rápidas e credenciais recentes">
              {/* Ações Rápidas */}
              <div className="rz-panel">
                <div className="rz-section-head" style={{ marginBottom: 12 }}>
                  <h2 className="rz-section-title">Ações Rápidas</h2>
                </div>
                <div className="home-quick-actions-grid">
                  <button
                    type="button"
                    className="home-quick-tile"
                    onClick={() => history.push('/vault/add')}
                  >
                    <span className="rz-icon-tile">
                      <Plus />
                    </span>
                    <span>Nova Credencial</span>
                  </button>

                  <button
                    type="button"
                    className="home-quick-tile"
                    onClick={() => history.push('/breach')}
                  >
                    <span className="rz-icon-tile warning">
                      <AlertTriangle />
                    </span>
                    <span>Varredura HIBP</span>
                  </button>

                  <button
                    type="button"
                    className="home-quick-tile"
                    onClick={() => history.push('/link-detector')}
                  >
                    <span className="rz-icon-tile">
                      <Globe />
                    </span>
                    <span>Analisar URL</span>
                  </button>

                  <button
                    type="button"
                    className="home-quick-tile"
                    onClick={() => history.push('/vpn')}
                  >
                    <span className="rz-icon-tile success">
                      <Wifi />
                    </span>
                    <span>Túnel WireGuard</span>
                  </button>
                </div>
              </div>

              {/* Credenciais Recentes */}
              <div className="rz-panel">
                <div className="rz-section-head" style={{ marginBottom: 12 }}>
                  <h2 className="rz-section-title">
                    Credenciais Recentes
                    <span className="rz-count">{recentCredentials.length}</span>
                  </h2>
                  <button
                    type="button"
                    className="rz-btn rz-btn-ghost rz-btn-sm"
                    onClick={() => history.push('/vault')}
                  >
                    Ver cofre
                  </button>
                </div>

                {recentCredentials.length === 0 ? (
                  <div className="home-audit-empty">
                    <p style={{ margin: '0 0 10px' }}>Nenhuma credencial armazenada ainda.</p>
                    <button
                      type="button"
                      className="rz-btn rz-btn-primary rz-btn-sm"
                      onClick={() => history.push('/vault/add')}
                    >
                      <Plus size={14} />
                      <span>Adicionar Primeira</span>
                    </button>
                  </div>
                ) : (
                  <div className="rz-list">
                    {recentCredentials.map((cred) => (
                      <button
                        key={cred.id}
                        type="button"
                        className="rz-row"
                        onClick={() => history.push(`/vault/detail/${cred.id}`)}
                      >
                        <span className="home-recent-avatar">
                          {(cred.title || '?').charAt(0).toUpperCase()}
                        </span>
                        <span className="rz-row-main">
                          <span className="rz-row-title" style={{ display: 'block' }}>
                            {cred.title}
                          </span>
                          <span className="rz-row-meta" style={{ display: 'block' }}>
                            {cred.username || 'Sem identificador'}
                          </span>
                        </span>
                        <span className="rz-row-trailing">
                          {cred.encryptedTotpSecret && (
                            <span className="rz-badge rz-badge-blue">2FA</span>
                          )}
                          <ChevronRight size={16} />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Telemetria do Envelope Zero-Knowledge */}
              <div className="rz-panel">
                <div className="rz-section-head" style={{ marginBottom: 10 }}>
                  <h2 className="rz-section-title">Envelope Criptográfico</h2>
                  <span className="rz-dot success is-live" />
                </div>
                <div className="rz-setting-row" style={{ padding: '8px 0' }}>
                  <span className="rz-text-muted">Cifra de Cofre</span>
                  <span className="rz-font-mono" style={{ fontSize: 'var(--rz-text-xs)', color: 'var(--rz-ice)' }}>
                    AES-256-GCM
                  </span>
                </div>
                <div className="rz-setting-row" style={{ padding: '8px 0' }}>
                  <span className="rz-text-muted">Derivação KDF</span>
                  <span className="rz-font-mono" style={{ fontSize: 'var(--rz-text-xs)', color: 'var(--rz-ice)' }}>
                    Argon2id
                  </span>
                </div>
                <div className="rz-setting-row" style={{ padding: '8px 0' }}>
                  <span className="rz-text-muted">Auto-Lock Inatividade</span>
                  <span className="rz-font-mono" style={{ fontSize: 'var(--rz-text-xs)', color: 'var(--rz-success)' }}>
                    5 min / Background
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={2200}
          color="dark"
          position="bottom"
        />

        <ConfirmModal
          isOpen={showDisable2FAConfirm}
          title="Desativar Segundo Fator (2FA)?"
          message="Ao desativar a autenticação de dois fatores, sua conta passará a exigir apenas a Senha Mestra para acesso, reduzindo a camada de defesa."
          confirmText="Desativar 2FA"
          cancelText="Manter 2FA"
          variant="warning"
          onConfirm={handleConfirmDisable2FA}
          onCancel={() => setShowDisable2FAConfirm(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default Home;
