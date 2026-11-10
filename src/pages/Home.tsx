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
  ArrowUpRight
} from 'lucide-react';
import { useSecurity } from '../contexts/SecurityContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { StorageService } from '../services/storage';
import { SessionService } from '../services/session';
import { AuditLog } from '../types';
import { getErrorMessage } from '../lib/utils';
import './Home.css';

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
    const handleFocus = () => {
      loadLogs();
      runVaultHealthCheck();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [runVaultHealthCheck]);

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

  const healthScore = vaultHealth ? vaultHealth.score : 100;
  const totalCreds = vaultHealth ? vaultHealth.total : 0;
  const weakOrReused = vaultHealth ? vaultHealth.weak + vaultHealth.reused : 0;
  const breachedCount = vaultHealth ? vaultHealth.breached : 0;

  return (
    <IonPage className="home-page">
      <IonContent fullscreen className="home-content">
        <div className="rz-page-container">
          {/* Header Executivo */}
          <header className="rz-page-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 className="rz-page-title">Painel de Segurança</h1>
                <span className="rz-badge rz-badge-blue">
                  Plano {isUltra ? 'Ultra' : isPro ? 'Pro' : 'Essencial'}
                </span>
              </div>
              <p className="rz-page-subtitle">
                Sessão criptografada ativa para <strong>{activeEmail || 'usuário local'}</strong> · Envelope AES-256-GCM + Argon2id
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                <RefreshCw size={14} />
                <span>Atualizar</span>
              </button>

              <button
                type="button"
                className="rz-btn rz-btn-primary"
                onClick={lockApp}
              >
                <Lock size={14} />
                <span>Bloquear Cofre</span>
              </button>
            </div>
          </header>

          {/* 1. KPI Grid */}
          <section className="home-kpi-grid" aria-label="Indicadores de segurança">
            <div className="home-kpi-card">
              <div className="home-kpi-top">
                <span>Índice de Postura</span>
                <ShieldCheck size={16} className="text-blue-500" />
              </div>
              <div className="home-kpi-value" style={{ color: healthScore >= 80 ? '#10b981' : healthScore >= 50 ? '#f59e0b' : '#ef4444' }}>
                {healthScore}%
              </div>
              <div className="home-kpi-foot">
                Cifragem Zero-Knowledge ativa
              </div>
            </div>

            <div className="home-kpi-card" onClick={() => history.push('/vault')} style={{ cursor: 'pointer' }}>
              <div className="home-kpi-top">
                <span>Credenciais no Cofre</span>
                <Lock size={16} className="text-zinc-400" />
              </div>
              <div className="home-kpi-value">{totalCreds}</div>
              <div className="home-kpi-foot">
                Gerenciar registros <ArrowUpRight size={12} style={{ display: 'inline' }} />
              </div>
            </div>

            <div className="home-kpi-card" onClick={() => history.push('/analysis')} style={{ cursor: 'pointer' }}>
              <div className="home-kpi-top">
                <span>Senhas Fracas / Repetidas</span>
                <Activity size={16} className="text-amber-500" />
              </div>
              <div className="home-kpi-value" style={{ color: weakOrReused > 0 ? '#f59e0b' : '#fafafa' }}>
                {weakOrReused}
              </div>
              <div className="home-kpi-foot">
                Diagnóstico de entropia <ArrowUpRight size={12} style={{ display: 'inline' }} />
              </div>
            </div>

            <div className="home-kpi-card" onClick={() => history.push('/breach')} style={{ cursor: 'pointer' }}>
              <div className="home-kpi-top">
                <span>Exposições HIBP</span>
                <AlertTriangle size={16} className="text-red-500" />
              </div>
              <div className="home-kpi-value" style={{ color: breachedCount > 0 ? '#ef4444' : '#fafafa' }}>
                {breachedCount}
              </div>
              <div className="home-kpi-foot">
                Auditoria k-Anonymity <ArrowUpRight size={12} style={{ display: 'inline' }} />
              </div>
            </div>
          </section>

          {/* 2. Módulos Operacionais */}
          <section style={{ marginBottom: 24 }}>
            <h2 className="home-section-heading">Módulos Operacionais</h2>
            <div className="home-modules-grid">
              <button type="button" className="home-module-item" onClick={() => history.push('/vault')}>
                <div className="home-module-icon"><Lock size={18} /></div>
                <div className="home-module-text">
                  <strong>Cofre de Credenciais</strong>
                  <span>Senhas, cartões, notas e códigos TOTP</span>
                </div>
              </button>

              <button type="button" className="home-module-item" onClick={() => history.push('/biometric-settings')}>
                <div className="home-module-icon"><Fingerprint size={18} /></div>
                <div className="home-module-text">
                  <strong>Biometria de Hardware</strong>
                  <span>{isBiometricEnabled ? 'Sensor físico vinculado e ativo' : 'Configurar leitor biométrico nativo'}</span>
                </div>
              </button>

              <button type="button" className="home-module-item" onClick={() => history.push('/breach')}>
                <div className="home-module-icon"><AlertTriangle size={18} /></div>
                <div className="home-module-text">
                  <strong>Vazamentos (HIBP)</strong>
                  <span>Verificação SHA-1 k-Anonymity</span>
                </div>
              </button>

              <button type="button" className="home-module-item" onClick={() => history.push('/link-detector')}>
                <div className="home-module-icon"><Globe size={18} /></div>
                <div className="home-module-text">
                  <strong>Detector Anti-Phishing</strong>
                  <span>Inspeção heurística de URLs suspeitas</span>
                </div>
              </button>

              <button type="button" className="home-module-item" onClick={() => history.push('/vpn')}>
                <div className="home-module-icon"><Wifi size={18} /></div>
                <div className="home-module-text">
                  <strong>Rede & VPN</strong>
                  <span>Auditoria de exposição de IP e túnel</span>
                </div>
              </button>

              <button type="button" className="home-module-item" onClick={() => history.push('/hardening')}>
                <div className="home-module-icon"><Sliders size={18} /></div>
                <div className="home-module-text">
                  <strong>Blindagem do Dispositivo</strong>
                  <span>Auto-lock, clipboard e privacidade</span>
                </div>
              </button>

              <button type="button" className="home-module-item" onClick={() => history.push('/analysis')}>
                <div className="home-module-icon"><Activity size={18} /></div>
                <div className="home-module-text">
                  <strong>Saúde das Senhas</strong>
                  <span>Análise de força e reutilização</span>
                </div>
              </button>

              <button type="button" className="home-module-item" onClick={() => history.push('/education')}>
                <div className="home-module-icon"><BookOpen size={18} /></div>
                <div className="home-module-text">
                  <strong>Base de Conhecimento</strong>
                  <span>Guias práticos e conformidade LGPD</span>
                </div>
              </button>
            </div>
          </section>

          {/* 3. Controles de Autenticação Rápida (PIN & 2FA) */}
          <section className="home-controls-grid">
            {/* PIN Local */}
            <div className="rz-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <KeyRound size={18} className="text-blue-500" />
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#fafafa' }}>
                    PIN de Reentrada Rápida
                  </h3>
                </div>
                <span className={`rz-badge ${hasPIN ? 'rz-badge-success' : 'rz-badge-warning'}`}>
                  {hasPIN ? 'Ativo' : 'Pendente'}
                </span>
              </div>

              <p style={{ fontSize: '0.8rem', color: '#a1a1aa', margin: '0 0 14px 0', lineHeight: 1.5 }}>
                Permite desbloquear a tela de bloqueio temporário com 6 dígitos numéricos sem redigitar a Senha Mestra completa.
              </p>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Novo PIN (6 dígitos)"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  className="rz-input"
                  style={{ flex: 1 }}
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
                <p style={{ color: '#f87171', fontSize: '0.75rem', margin: '8px 0 0 0' }}>{pinError}</p>
              )}
            </div>

            {/* 2FA TOTP */}
            <div className="rz-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ShieldCheck size={18} className="text-blue-500" />
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#fafafa' }}>
                    Segundo Fator (2FA TOTP)
                  </h3>
                </div>
                <span className={`rz-badge ${totpEnabled ? 'rz-badge-success' : 'rz-badge-neutral'}`}>
                  {totpEnabled ? 'Ativado' : 'Opcional'}
                </span>
              </div>

              {totpEnabled ? (
                <div>
                  <p style={{ fontSize: '0.8rem', color: '#a1a1aa', margin: '0 0 14px 0', lineHeight: 1.5 }}>
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
                  <p style={{ fontSize: '0.8rem', color: '#a1a1aa', margin: '0 0 14px 0', lineHeight: 1.5 }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#09090b', padding: 10, borderRadius: 8, border: '1px solid #27272a' }}>
                    {currentLocalSecret && (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                          `otpauth://totp/RiskZero:${encodeURIComponent(activeEmail || 'usuario')}?secret=${currentLocalSecret}&issuer=RiskZero`
                        )}`}
                        alt="QR Code 2FA"
                        style={{ width: 88, height: 88, borderRadius: 6, background: '#fff', padding: 4 }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="rz-label">SEGREDO BASE32</div>
                      <code style={{ display: 'block', fontSize: '0.75rem', color: '#fafafa', wordBreak: 'break-all', marginBottom: 6 }}>
                        {currentLocalSecret}
                      </code>
                      <button
                        type="button"
                        className="rz-btn rz-btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        onClick={() => currentLocalSecret && handleCopySecret(currentLocalSecret)}
                      >
                        <Copy size={12} />
                        <span>Copiar chave</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Código de 6 dígitos"
                      value={totpTokenInput}
                      onChange={(e) => setTotpTokenInput(e.target.value.replace(/\D/g, ''))}
                      className="rz-input"
                      style={{ flex: 1 }}
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
                    <p style={{ color: '#f87171', fontSize: '0.75rem', margin: 0 }}>{mfaError}</p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* 4. Trilha de Auditoria LGPD */}
          <section className="rz-card" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#fafafa' }}>
                  Trilha de Auditoria Local (LGPD Art. 7º & ISO/IEC 27001)
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#a1a1aa' }}>
                  Registro cronológico de eventos de autenticação, leitura e modificação do cofre.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportAuditCSV}
                disabled={isExportingCSV || auditLogs.length === 0}
                className="rz-btn rz-btn-secondary"
              >
                <Download size={14} />
                <span>{isExportingCSV ? 'Exportando...' : 'Exportar CSV'}</span>
              </button>
            </div>

            {auditLogs.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#71717a', fontSize: '0.825rem', background: '#09090b', borderRadius: 8, border: '1px solid #27272a' }}>
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
