import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonContent,
  IonPage,
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonText,
  IonItem,
  IonLabel,
  IonInput,
  IonList,
  IonBadge,
  IonToast,
} from '@ionic/react';
import {
  lockClosedOutline,
  shieldCheckmarkOutline,
  keyOutline,
  logOutOutline,
  documentTextOutline,
  fingerPrintOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  trendingUpOutline,
  eyeOffOutline,
  schoolOutline,
  wifiOutline,
  warningOutline,
  settingsOutline,
  downloadOutline,
  copyOutline,
  sparklesOutline,
  globeOutline,
  refreshOutline,
} from 'ionicons/icons';
import { useSecurity } from '../contexts/SecurityContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { StorageService } from '../services/storage';
import { SessionService } from '../services/session';
import { AuditLog } from '../types';
import { getErrorMessage } from '../lib/utils';
import './Home.css';

const Home: React.FC = () => {
  const history = useHistory();
  const {
    logout,
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
  } = useSecurity();
  const { isPro, isUltra } = useSubscription();

  // Estados locais para configuração
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

  // Carrega e atualiza logs de auditoria
  const loadLogs = async () => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    const logs = await StorageService.getAuditLogs(email);
    setAuditLogs(logs);
  };

  useEffect(() => {
    loadLogs();
    const handleFocus = () => {
      loadLogs();
      runVaultHealthCheck();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [runVaultHealthCheck]);

  // Handler para salvar PIN local
  const handleSavePIN = async () => {
    setPinError(null);
    if (pinInput.length !== 6 || isNaN(Number(pinInput))) {
      setPinError('O PIN deve conter exatamente 6 números.');
      return;
    }
    try {
      await registerPIN(pinInput);
      setPinInput('');
      await loadLogs();
      setToastMsg('Código PIN de 6 dígitos configurado.');
      setShowToast(true);
    } catch (e: unknown) {
      setPinError(getErrorMessage(e) || 'Erro ao registrar PIN.');
    }
  };

  // Handler para iniciar configuração de 2FA
  const handleStart2FA = () => {
    setMfaError(null);
    const secret = setupNew2FA();
    setCurrentLocalSecret(secret);
    setShow2FASetup(true);
  };

  // Handler para copiar chave secreta Base32
  const handleCopySecret = async (secret: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(secret);
      }
      setToastMsg('Chave secreta Base32 copiada para a área de transferência.');
      setShowToast(true);
    } catch {
      setToastMsg('Chave secreta selecionada.');
      setShowToast(true);
    }
  };

  // Handler para validar e ativar 2FA
  const handleConfirm2FA = async () => {
    setMfaError(null);
    const res = await enable2FA(totpTokenInput);
    if (res.success) {
      setTotpTokenInput('');
      setCurrentLocalSecret(null);
      setShow2FASetup(false);
      await loadLogs();
      setToastMsg('Autenticação em duas etapas (2FA - TOTP) ativada com sucesso.');
      setShowToast(true);
    } else {
      setMfaError(res.error || 'Código 2FA incorreto ou expirado.');
    }
  };

  // Handler para desativar 2FA
  const handleDisable2FA = async () => {
    if (window.confirm('Tem certeza que deseja desativar o 2FA? Isso reduzirá a proteção da sua conta.')) {
      await disable2FA();
      setCurrentLocalSecret(null);
      setShow2FASetup(false);
      await loadLogs();
      setToastMsg('Autenticação 2FA desativada.');
      setShowToast(true);
    }
  };

  // Handler para exportar Relatório de Auditoria em CSV (LGPD)
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
      setToastMsg('Relatório de auditoria CSV (RFC 4180 / LGPD) exportado com sucesso.');
      setShowToast(true);
    } catch {
      setToastMsg('Erro ao gerar exportação de auditoria.');
      setShowToast(true);
    } finally {
      setIsExportingCSV(false);
    }
  };

  // Telemetria do Score de Saúde do Cofre
  const healthScore = vaultHealth ? vaultHealth.score : 100;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;
  const scoreColor = healthScore >= 80 ? '#10b981' : healthScore >= 50 ? '#f59e0b' : '#ef4444';

  const userInitial = activeEmail ? activeEmail.charAt(0).toUpperCase() : 'R';

  return (
    <IonPage>
      <IonContent className="home-content ion-padding">
        <div className="home-container animate-fade-in">

          {/* ================================================================
              1. Header Cockpit & Perfil de Telemetria
              ================================================================ */}
          <div className="home-header-cockpit">
            <div className="user-profile-deck">
              <div className="avatar-badge-wrapper">
                <div className="avatar-badge">
                  {userInitial}
                </div>
                <div className="avatar-status-dot" title="Sessão Criptografada Ativa" />
              </div>
              <div className="user-meta-info">
                <div className="user-greeting-row">
                  <h1 className="user-title">Central de Defesa</h1>
                  <span className="status-beacon-pill">Zero-Knowledge</span>
                </div>
                <span className="user-email-tag">
                  <IonIcon icon={shieldCheckmarkOutline} style={{ color: '#60a5fa' }} />
                  {activeEmail || 'Usuário Autenticado'}
                </span>
              </div>
            </div>

            <div className="header-action-deck">
              <div
                onClick={() => history.push('/plans')}
                className={`plan-tier-badge ${isUltra ? 'ultra' : isPro ? 'pro' : 'free'}`}
                title="Gerenciar Plano de Assinatura"
              >
                <IonIcon icon={sparklesOutline} />
                <span>{isUltra ? 'ULTRA' : isPro ? 'PRO' : 'FREE'}</span>
              </div>

              <button
                type="button"
                onClick={() => history.push('/settings')}
                className="header-icon-btn"
                title="Ajustes e Configurações"
                aria-label="Ajustes e Configurações"
              >
                <IonIcon icon={settingsOutline} />
              </button>

              <button
                type="button"
                onClick={lockApp}
                className="header-icon-btn lock-btn"
                title="Bloquear Aplicativo Imediatamente"
                aria-label="Bloquear Aplicativo Imediatamente"
              >
                <IonIcon icon={lockClosedOutline} />
              </button>
            </div>
          </div>

          {/* ================================================================
              2. Hero Card de Telemetria Proativa (k-Anonymity & Cifragem)
              ================================================================ */}
          <div className="telemetry-hero-card">
            <div className="telemetry-flex-row">
              <div className="telemetry-main-col">
                <div className="telemetry-gauge-box">
                  <svg className="telemetry-gauge-svg" viewBox="0 0 90 90">
                    <circle
                      className="telemetry-gauge-bg"
                      cx="45"
                      cy="45"
                      r={radius}
                    />
                    <circle
                      className="telemetry-gauge-bar"
                      cx="45"
                      cy="45"
                      r={radius}
                      stroke={scoreColor}
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                    />
                  </svg>
                  <div className="telemetry-gauge-center">
                    <span className="telemetry-gauge-score" style={{ color: scoreColor }}>
                      {healthScore}%
                    </span>
                    <span className="telemetry-gauge-unit">Índice</span>
                  </div>
                </div>

                <div className="telemetry-text-col">
                  <h3 className="telemetry-title">Postura Cibernética Ativa</h3>
                  <p className="telemetry-desc">
                    Auditoria de integridade em memória RAM k-Anonymity HIBP. Seus dados nunca saem descriptografados do dispositivo.
                  </p>
                </div>
              </div>

              {/* Botão de atualização rápida */}
              <IonButton
                fill="clear"
                size="small"
                onClick={() => {
                  runVaultHealthCheck();
                  loadLogs();
                  setToastMsg('Auditoria em tempo real concluída!');
                  setShowToast(true);
                }}
                style={{ color: '#60a5fa', fontWeight: 700 }}
              >
                <IonIcon icon={refreshOutline} slot="start" />
                Atualizar Status
              </IonButton>
            </div>

            {/* Pills de Detalhes de Telemetria */}
            <div className="telemetry-specs-row">
              <div className="telemetry-pill secure">
                <IonIcon icon={checkmarkCircleOutline} />
                <span>Envelope DEK/KEK (AES-256)</span>
              </div>
              <div className={`telemetry-pill ${totpEnabled ? 'secure' : 'warning'}`}>
                <IonIcon icon={totpEnabled ? checkmarkCircleOutline : warningOutline} />
                <span>2FA TOTP: {totpEnabled ? 'Ativado' : 'Não Ativado'}</span>
              </div>
              <div className={`telemetry-pill ${hasPIN ? 'secure' : 'warning'}`}>
                <IonIcon icon={hasPIN ? checkmarkCircleOutline : warningOutline} />
                <span>PIN Local: {hasPIN ? 'Ativo' : 'Pendente'}</span>
              </div>

              {vaultHealth && vaultHealth.breached > 0 && (
                <div
                  onClick={() => history.push('/breach')}
                  className="telemetry-pill danger"
                  style={{ cursor: 'pointer' }}
                >
                  <IonIcon icon={warningOutline} />
                  <span>{vaultHealth.breached} {vaultHealth.breached === 1 ? 'vazada' : 'vazadas'}</span>
                </div>
              )}

              {vaultHealth && vaultHealth.weak > 0 && (
                <div
                  onClick={() => history.push('/analysis')}
                  className="telemetry-pill warning"
                  style={{ cursor: 'pointer' }}
                >
                  <IonIcon icon={trendingUpOutline} />
                  <span>{vaultHealth.weak} {vaultHealth.weak === 1 ? 'senha fraca' : 'senhas fracas'}</span>
                </div>
              )}

              {vaultHealth && vaultHealth.reused > 0 && (
                <div
                  onClick={() => history.push('/analysis')}
                  className="telemetry-pill warning"
                  style={{ cursor: 'pointer' }}
                >
                  <IonIcon icon={refreshOutline} />
                  <span>{vaultHealth.reused} {vaultHealth.reused === 1 ? 'reutilizada' : 'reutilizadas'}</span>
                </div>
              )}
            </div>
          </div>

          {/* ================================================================
              3. Módulos de Criptografia & Tráfego de Rede
              ================================================================ */}
          <div className="section-headline">
            <h2>Módulos de Criptografia & Tráfego</h2>
          </div>

          <div className="quick-links-grid">
            <div onClick={() => history.push('/vault')} className="quick-link-card vault">
              <div className="quick-card-header">
                <div className="card-icon-bubble" style={{ background: 'rgba(96, 165, 250, 0.12)', color: '#60a5fa' }}>
                  <IonIcon icon={lockClosedOutline} />
                </div>
                <span className="quick-card-badge">Zero-Knowledge</span>
              </div>
              <div className="quick-card-body">
                <span className="quick-link-title">Cofre de Credenciais</span>
                <span className="quick-link-desc">Senhas, cartões e notas protegidos por chave DEK em RAM</span>
              </div>
            </div>

            <div onClick={() => history.push('/vpn')} className="quick-link-card vpn">
              <div className="quick-card-header">
                <div className="card-icon-bubble" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                  <IonIcon icon={wifiOutline} />
                </div>
                <span className="quick-card-badge">WireGuard</span>
              </div>
              <div className="quick-card-body">
                <span className="quick-link-title">VPN & Túnel Seguro</span>
                <span className="quick-link-desc">Tráfego de rede blindado e auditoria de IP público</span>
              </div>
            </div>

            <div onClick={() => history.push('/breach')} className="quick-link-card breach">
              <div className="quick-card-header">
                <div className="card-icon-bubble" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                  <IonIcon icon={warningOutline} />
                </div>
                <span className="quick-card-badge">k-Anonymity</span>
              </div>
              <div className="quick-card-body">
                <span className="quick-link-title">Auditoria de Vazamentos</span>
                <span className="quick-link-desc">Consulte se contas ou senhas foram expostas na web</span>
              </div>
            </div>

            <div onClick={() => history.push('/link-detector')} className="quick-link-card detector">
              <div className="quick-card-header">
                <div className="card-icon-bubble" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                  <IonIcon icon={globeOutline} />
                </div>
                <span className="quick-card-badge">Anti-Phishing</span>
              </div>
              <div className="quick-card-body">
                <span className="quick-link-title">Detector de Links</span>
                <span className="quick-link-desc">Análise heurística de URLs maliciosas e golpes digitais</span>
              </div>
            </div>
          </div>

          {/* ================================================================
              4. Módulos de Defesa no Dispositivo & Bem-Estar Digital
              ================================================================ */}
          <div className="section-headline">
            <h2>Blindagem Local & Educação</h2>
          </div>

          <div className="quick-links-grid">
            <div onClick={() => history.push('/hardening')} className="quick-link-card hardening">
              <div className="quick-card-header">
                <div className="card-icon-bubble" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4' }}>
                  <IonIcon icon={eyeOffOutline} />
                </div>
                <span className="quick-card-badge">Hardening</span>
              </div>
              <div className="quick-card-body">
                <span className="quick-link-title">Proteção do Aparelho</span>
                <span className="quick-link-desc">Anti-screenshot, camuflagem e limpeza de clipboard em 30s</span>
              </div>
            </div>

            <div onClick={() => history.push('/biometric-settings')} className="quick-link-card biometrics">
              <div className="quick-card-header">
                <div className="card-icon-bubble" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc' }}>
                  <IonIcon icon={fingerPrintOutline} />
                </div>
                <span className="quick-card-badge">WebAuthn</span>
              </div>
              <div className="quick-card-body">
                <span className="quick-link-title">Biometria & Hardware</span>
                <span className="quick-link-desc">Desbloqueio por digital e integração de segurança nativa</span>
              </div>
            </div>

            <div onClick={() => history.push('/analysis')} className="quick-link-card analysis">
              <div className="quick-card-header">
                <div className="card-icon-bubble" style={{ background: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' }}>
                  <IonIcon icon={trendingUpOutline} />
                </div>
                <span className="quick-card-badge">Entropia</span>
              </div>
              <div className="quick-card-body">
                <span className="quick-link-title">Saúde das Senhas</span>
                <span className="quick-link-desc">Diagnóstico de complexidade, repetições e vulnerabilidades</span>
              </div>
            </div>

            <div onClick={() => history.push('/education')} className="quick-link-card education">
              <div className="quick-card-header">
                <div className="card-icon-bubble" style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899' }}>
                  <IonIcon icon={schoolOutline} />
                </div>
                <span className="quick-card-badge">13 Guias</span>
              </div>
              <div className="quick-card-body">
                <span className="quick-link-title">Módulo Educativo</span>
                <span className="quick-link-desc">Treinamento corporativo, boas práticas e Quiz LGPD</span>
              </div>
            </div>
          </div>

          {/* ================================================================
              5. CARD: Criptografia Zero-Knowledge & Postura Local
              ================================================================ */}
          <IonCard className="premium-card bg-glow-blue">
            <IonCardContent className="premium-card-content">
              <div className="card-header-icon">
                <IonIcon icon={shieldCheckmarkOutline} className="icon-blue" />
                <div>
                  <h3>Arquitetura Zero-Knowledge</h3>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Nenhuma senha ou segredo em texto claro trafega pela rede
                  </span>
                </div>
              </div>

              <p className="card-description">
                Suas credenciais são cifradas exclusivamente no hardware do seu dispositivo usando Envelope Encryption (DEK/KEK) com chaves derivadas por Argon2id e PBKDF2 (600.000 iterações).
              </p>

              <div className="security-badges">
                <IonBadge color="success" className="sec-badge">
                  <IonIcon icon={checkmarkCircleOutline} /> AES-256-GCM Autenticado
                </IonBadge>
                <IonBadge color="success" className="sec-badge">
                  <IonIcon icon={checkmarkCircleOutline} /> Derivação Argon2id + PBKDF2
                </IonBadge>
                <IonBadge color={hasPIN ? 'success' : 'warning'} className="sec-badge">
                  <IonIcon icon={hasPIN ? checkmarkCircleOutline : closeCircleOutline} />
                  {hasPIN ? 'PIN Rápido Ativo' : 'Sem PIN Configurado'}
                </IonBadge>
                <IonBadge color={totpEnabled ? 'success' : 'warning'} className="sec-badge">
                  <IonIcon icon={totpEnabled ? checkmarkCircleOutline : closeCircleOutline} />
                  {totpEnabled ? '2FA TOTP Blindado' : '2FA Pendente'}
                </IonBadge>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <IonButton
                  expand="block"
                  onClick={lockApp}
                  className="btn-action-primary"
                  style={{ flex: 1, minWidth: '220px' }}
                >
                  <IonIcon slot="start" icon={lockClosedOutline} />
                  Bloquear Aplicativo Agora
                </IonButton>

                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={logout}
                  className="btn-action-danger"
                  style={{ minWidth: '140px' }}
                >
                  <IonIcon slot="start" icon={logOutOutline} />
                  Sair
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>

          {/* ================================================================
              6. CARD: Acesso Rápido com PIN Local (Hot Re-entry)
              ================================================================ */}
          <IonCard className="premium-card">
            <IonCardContent className="premium-card-content">
              <div className="card-header-icon">
                <IonIcon icon={fingerPrintOutline} className="icon-purple" />
                <div>
                  <h3>Acesso Rápido com PIN (Hot Re-entry)</h3>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Desbloqueie instantaneamente sem digitar a Senha Mestra longa
                  </span>
                </div>
              </div>

              <p className="card-description">
                Cadastre um código de 6 números para desbloquear o cofre de forma segura durante o dia. A Senha Mestra permanece protegida na memória criptografada.
              </p>

              {hasPIN ? (
                <div className="pin-active-indicator">
                  <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: '20px' }} />
                  <div>
                    <strong style={{ display: 'block' }}>Código PIN ativo neste dispositivo</strong>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      Você pode alterar o código atual digitando um novo PIN abaixo.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="pin-inactive-indicator">
                  <IonIcon icon={warningOutline} style={{ fontSize: '20px' }} />
                  <div>
                    <strong style={{ display: 'block' }}>Código PIN ainda não configurado</strong>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      Recomendado para agilizar o acesso no dia a dia.
                    </span>
                  </div>
                </div>
              )}

              <div className="inline-action-form">
                <IonItem className="premium-input-item" lines="none">
                  <IonInput
                    type="password"
                    inputmode="numeric"
                    maxlength={6}
                    placeholder="Novo PIN (6 números)"
                    value={pinInput}
                    onIonInput={(e) => setPinInput(e.detail.value!)}
                  />
                </IonItem>
                <IonButton
                  color="secondary"
                  onClick={handleSavePIN}
                  disabled={pinInput.length !== 6}
                  style={{ height: '48px', '--border-radius': '14px', fontWeight: 800 }}
                >
                  {hasPIN ? 'Atualizar PIN' : 'Ativar PIN'}
                </IonButton>
              </div>
              {pinError && (
                <IonText color="danger">
                  <p className="input-error-msg">{pinError}</p>
                </IonText>
              )}
            </IonCardContent>
          </IonCard>

          {/* ================================================================
              7. CARD: Autenticação em Duas Etapas (2FA / TOTP)
              ================================================================ */}
          <IonCard className="premium-card">
            <IonCardContent className="premium-card-content">
              <div className="card-header-icon">
                <IonIcon icon={keyOutline} className="icon-emerald" />
                <div>
                  <h3>Verificação em Duas Etapas (2FA - TOTP)</h3>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Proteção com Google Authenticator, Authy ou Microsoft Authenticator
                  </span>
                </div>
              </div>

              <p className="card-description">
                Adicione uma barreira intransponível contra invasões exigindo um código temporário de 6 dígitos gerado em seu aplicativo autenticador.
              </p>

              {totpEnabled ? (
                <div>
                  <div className="totp-status-active">
                    <IonIcon icon={checkmarkCircleOutline} style={{ color: '#10b981', fontSize: '26px', flexShrink: 0 }} />
                    <div>
                      <strong style={{ color: '#10b981', display: 'block', fontSize: '0.95rem' }}>
                        Proteção 2FA Ativada e Válida
                      </strong>
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                        Códigos temporários TOTP de 30 segundos são exigidos no login.
                      </span>
                    </div>
                  </div>

                  <IonButton
                    fill="outline"
                    color="danger"
                    expand="block"
                    onClick={handleDisable2FA}
                    className="btn-action-danger"
                  >
                    Desativar Proteção 2FA
                  </IonButton>
                </div>
              ) : (
                <div>
                  {!show2FASetup ? (
                    <IonButton
                      expand="block"
                      color="success"
                      onClick={handleStart2FA}
                      className="btn-action-primary"
                    >
                      Configurar Autenticador 2FA
                    </IonButton>
                  ) : (
                    <div className="totp-setup-flow animate-fade-in">
                      <p className="totp-setup-title">
                        1. Escaneie o QR Code abaixo no seu app autenticador ou copie a chave secreta:
                      </p>

                      {currentLocalSecret && (
                        <div className="totp-qr-container">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                              `otpauth://totp/RiskZero:${encodeURIComponent(activeEmail || 'usuario')}?secret=${currentLocalSecret}&issuer=RiskZero`
                            )}`}
                            alt="QR Code para Autenticador 2FA"
                            className="totp-qr-image"
                          />
                        </div>
                      )}

                      <div className="totp-secret-box">
                        <span style={{ color: '#94a3b8', fontSize: '0.74rem', fontWeight: 800, display: 'block', marginBottom: '8px' }}>
                          CHAVE SECRETA BASE32
                        </span>
                        <code>{currentLocalSecret}</code>
                        <div style={{ marginTop: '10px' }}>
                          <IonButton
                            size="small"
                            fill="clear"
                            onClick={() => currentLocalSecret && handleCopySecret(currentLocalSecret)}
                            style={{ color: '#60a5fa', fontWeight: 700 }}
                          >
                            <IonIcon icon={copyOutline} slot="start" />
                            Copiar Chave Secreta
                          </IonButton>
                        </div>
                      </div>

                      <p className="totp-setup-title" style={{ marginTop: '18px' }}>
                        2. Digite o código de 6 dígitos gerado no autenticador para confirmar:
                      </p>

                      <div className="inline-action-form">
                        <IonItem className="premium-input-item" lines="none">
                          <IonInput
                            type="text"
                            inputmode="numeric"
                            maxlength={6}
                            placeholder="000000"
                            value={totpTokenInput}
                            onIonInput={(e) => setTotpTokenInput((e.detail.value || '').trim())}
                          />
                        </IonItem>
                        <IonButton
                          color="success"
                          onClick={handleConfirm2FA}
                          disabled={totpTokenInput.length < 6}
                          style={{ height: '48px', '--border-radius': '14px', fontWeight: 800 }}
                        >
                          Confirmar
                        </IonButton>
                      </div>

                      {mfaError && (
                        <IonText color="danger">
                          <p className="input-error-msg">{mfaError}</p>
                        </IonText>
                      )}

                      <IonButton
                        fill="clear"
                        color="medium"
                        expand="block"
                        onClick={() => setShow2FASetup(false)}
                        style={{ marginTop: '12px' }}
                      >
                        Cancelar
                      </IonButton>
                    </div>
                  )}
                </div>
              )}
            </IonCardContent>
          </IonCard>

          {/* ================================================================
              8. CARD: Trilha de Auditoria & Conformidade LGPD
              ================================================================ */}
          <IonCard className="premium-card">
            <IonCardContent className="premium-card-content">
              <div className="card-header-icon">
                <IonIcon icon={documentTextOutline} className="icon-amber" />
                <div>
                  <h3>Trilha de Auditoria de Segurança</h3>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Conformidade com LGPD (Art. 7º) e ISO/IEC 27001
                  </span>
                </div>
              </div>

              <p className="card-description">
                Registro inviolável de acessos, alterações de credenciais e eventos de segurança gerados neste aparelho.
              </p>

              <div className="audit-logs-list-wrapper">
                {auditLogs.length === 0 ? (
                  <p className="no-logs-text">Nenhuma atividade registrada até o momento.</p>
                ) : (
                  <IonList className="audit-logs-list" lines="none">
                    {auditLogs.slice(0, 15).map((log) => {
                      const isSuccess = log.action.includes('SUCCESS') || log.action.includes('CREATED');
                      const isWarning = log.action.includes('FAILED') || log.action.includes('BREACH');
                      const dotClass = isSuccess ? 'emerald' : isWarning ? 'red' : 'cyan';

                      return (
                        <IonItem key={log.id} className="audit-log-item">
                          <div className={`log-dot ${dotClass}`} />
                          <IonLabel>
                            <h4>{log.details}</h4>
                            <p>
                              {new Date(log.timestamp).toLocaleTimeString()} - {log.action}
                            </p>
                          </IonLabel>
                        </IonItem>
                      );
                    })}
                  </IonList>
                )}
              </div>

              <div className="audit-footer-actions">
                <IonButton
                  fill="clear"
                  size="small"
                  onClick={handleExportAuditCSV}
                  disabled={isExportingCSV || auditLogs.length === 0}
                  style={{ color: '#60a5fa', fontWeight: 700 }}
                >
                  <IonIcon icon={downloadOutline} slot="start" />
                  {isExportingCSV ? 'Exportando...' : 'Exportar Relatório CSV (LGPD)'}
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>

        </div>

        {/* Toast de Feedback Global */}
        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={2500}
          color="dark"
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};

export default Home;
