import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonContent,
  IonToast,
} from '@ionic/react';
import {
  EyeOff,
  Clipboard,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  Lock,
  Clock,
  FileSpreadsheet,
  FileJson,
  Play,
  KeyRound
} from 'lucide-react';
import { HardeningService } from '../../services/hardening';
import { ClipboardService } from '../../services/clipboard';
import { StorageService } from '../../services/storage';
import { SessionService } from '../../services/session';
import { useSecurity } from '../../contexts/SecurityContext';
import { AuditLog } from '../../types';
import { getErrorMessage } from '../../lib/utils';
import './HardeningPage.css';

export const HardeningPage: React.FC = () => {
  const {
    hasPIN,
    hasPanicPIN,
    isCamouflageMode,
    registerPanicPIN,
    disablePanicPIN,
    lockApp,
  } = useSecurity();

  const [screenshotBlocked, setScreenshotBlocked] = useState<boolean>(() =>
    HardeningService.isPrivacyScreenEnabled()
  );
  const [clipboardDemo, setClipboardDemo] = useState(false);
  const [clipboardCountdown, setClipboardCountdown] = useState(0);
  const [isNative, setIsNative] = useState(false);

  // Estados do PIN de Pânico & Camuflagem
  const [showPanicForm, setShowPanicForm] = useState<boolean>(false);
  const [panicPinInput, setPanicPinInput] = useState<string>('');
  const [panicPinConfirm, setPanicPinConfirm] = useState<string>('');
  const [panicError, setPanicError] = useState<string | null>(null);
  const [savingPanic, setSavingPanic] = useState<boolean>(false);

  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    setIsNative(HardeningService.isNative());
    setScreenshotBlocked(HardeningService.isPrivacyScreenEnabled());
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    const logs = await StorageService.getAuditLogs(email);
    setRecentLogs(logs.slice(0, 6));
  };

  const handleScreenshotToggle = async (enabled: boolean) => {
    setScreenshotBlocked(enabled);
    if (enabled) {
      await HardeningService.enablePrivacyScreen();
      setToastMsg(
        isNative
          ? 'FLAG_SECURE ativado: capturas de tela bloqueadas no Android.'
          : 'Cortina de Privacidade ativada: a tela será ocultada ao detectar PrintScreen ou perda de foco (Win+Shift+S).'
      );
    } else {
      await HardeningService.disablePrivacyScreen();
      setToastMsg('Proteção contra capturas de tela desativada.');
    }
    setShowToast(true);
    await loadLogs();
  };

  const handleTestPrivacyCurtain = async () => {
    if (!screenshotBlocked) {
      await handleScreenshotToggle(true);
    }
    window.dispatchEvent(new Event('blur'));
  };

  const handleClipboardDemo = async () => {
    setClipboardDemo(true);
    const demoText = 'SenhaExemplo@123!Demo';
    await ClipboardService.copySecure(
      demoText,
      'Senha Demonstração',
      (_msg, timeLeft) => {
        setClipboardCountdown(timeLeft);
        if (timeLeft === 0) {
          setClipboardDemo(false);
          setToastMsg('Área de transferência sobrescrita e limpa automaticamente.');
          setShowToast(true);
          loadLogs();
        }
      }
    );
    setToastMsg('Senha copiada! Autodestruição da área de transferência iniciada (30s).');
    setShowToast(true);
  };

  const handleClearNow = async () => {
    await ClipboardService.clearNow();
    setClipboardDemo(false);
    setClipboardCountdown(0);
    setToastMsg('Área de transferência limpa imediatamente.');
    setShowToast(true);
    await loadLogs();
  };

  const handleToggleCamouflage = async (checked: boolean) => {
    setPanicError(null);
    if (checked) {
      setShowPanicForm(true);
    } else {
      setShowPanicForm(false);
      setPanicPinInput('');
      setPanicPinConfirm('');
      if (hasPanicPIN) {
        await disablePanicPIN();
        setToastMsg('PIN de Pânico & Camuflagem desativado.');
        setShowToast(true);
        await loadLogs();
      }
    }
  };

  const handleSavePanicPIN = async (e: React.FormEvent) => {
    e.preventDefault();
    setPanicError(null);

    if (panicPinInput.length !== 6 || isNaN(Number(panicPinInput))) {
      setPanicError('O PIN de Pânico deve conter exatamente 6 dígitos numéricos.');
      return;
    }

    if (panicPinInput !== panicPinConfirm) {
      setPanicError('A confirmação do PIN de Pânico não confere.');
      return;
    }

    setSavingPanic(true);
    try {
      await registerPanicPIN(panicPinInput);
      setPanicPinInput('');
      setPanicPinConfirm('');
      setShowPanicForm(false);
      setToastMsg('PIN de Pânico & Camuflagem ativado com sucesso!');
      setShowToast(true);
      await loadLogs();
    } catch (err: unknown) {
      setPanicError(getErrorMessage(err) || 'Erro ao salvar PIN de Pânico.');
    } finally {
      setSavingPanic(false);
    }
  };

  const handleExportCSV = async () => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    try {
      const csv = await StorageService.exportAuditLogsCSV(email);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_seguranca_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToastMsg('Relatório CSV exportado.');
    } catch {
      setToastMsg('Erro ao exportar CSV.');
    }
    setShowToast(true);
  };

  const handleExportJSON = async () => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    try {
      const json = await StorageService.exportAuditLogsJSON(email);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_lgpd_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToastMsg('Relatório LGPD (JSON) exportado.');
    } catch {
      setToastMsg('Erro ao exportar JSON.');
    }
    setShowToast(true);
  };

  return (
    <IonPage className="hardening-page">
      <IonContent fullscreen className="hardening-content">
        <div className="rz-page-container" style={{ maxWidth: 880 }}>
          <header className="rz-page-header">
            <div>
              <h1 className="rz-page-title">Blindagem do Dispositivo</h1>
              <p className="rz-page-subtitle">
                Controles ativos contra captura de tela, exfiltração de clipboard e coação presencial.
              </p>
            </div>
            <span className={`rz-badge ${isNative ? 'rz-badge-success' : 'rz-badge-blue'}`}>
              {isNative ? 'Ambiente Android Nativo' : 'Proteção Web / Windows Ativa'}
            </span>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 1. Bloqueio de Capturas de Tela */}
            <section className="rz-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(37, 99, 235, 0.14)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <EyeOff size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#fafafa' }}>
                        Bloqueio de Capturas de Tela (Cortina de Privacidade)
                      </h2>
                      <span className={`rz-badge ${screenshotBlocked ? 'rz-badge-success' : 'rz-badge-neutral'}`}>
                        {screenshotBlocked ? 'Protegido' : 'Inativo'}
                      </span>
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: '0.825rem', color: '#a1a1aa', lineHeight: 1.5 }}>
                      No Windows/Web, aciona instantaneamente uma <strong>Cortina Preta de Privacidade</strong> ao detectar perda de foco da janela (como ao abrir a Ferramenta de Captura <code>Win+Shift+S</code> ou <code>Alt+Tab</code>) e intercepta a tecla <code>PrintScreen</code> limpando a área de transferência. No Android nativo, aplica <code>FLAG_SECURE</code>.
                    </p>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={screenshotBlocked}
                    onChange={(e) => handleScreenshotToggle(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#fafafa' }}>
                    {screenshotBlocked ? 'Ativado' : 'Ativar'}
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid #27272a' }}>
                <span style={{ fontSize: '0.78rem', color: screenshotBlocked ? '#10b981' : '#71717a' }}>
                  {screenshotBlocked
                    ? '✓ Cortina ativa: tente pressionar Win+Shift+S, Alt+Tab ou PrintScreen.'
                    : 'Ative a chave acima para blindar a janela contra capturas.'}
                </span>

                <button
                  type="button"
                  className="rz-btn rz-btn-secondary"
                  onClick={handleTestPrivacyCurtain}
                >
                  <Play size={14} />
                  <span>Simular Captura / Testar Cortina</span>
                </button>
              </div>
            </section>

            {/* 2. PIN de Pânico & Camuflagem (Duress PIN) */}
            <section className="rz-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(245, 158, 11, 0.14)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <KeyRound size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#fafafa' }}>
                        PIN de Pânico &amp; Cofre de Fachada (Modo Camuflagem)
                      </h2>
                      <span className={`rz-badge ${hasPanicPIN ? 'rz-badge-success' : 'rz-badge-warning'}`}>
                        {hasPanicPIN ? 'PIN de Pânico Configurado' : 'Não Configurado'}
                      </span>
                      {isCamouflageMode && (
                        <span className="rz-badge rz-badge-blue">Modo Fachada Ativo</span>
                      )}
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: '0.825rem', color: '#a1a1aa', lineHeight: 1.5 }}>
                      Em situações de coação (assalto ou coerção presencial), digitar o seu <strong>PIN de Pânico de 6 dígitos</strong> na tela de bloqueio abre silenciosamente um <strong>Cofre de Fachada</strong> com contas fictícias inofensivas, mantendo suas senhas reais 100% ocultas.
                    </p>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={hasPanicPIN || showPanicForm}
                    onChange={(e) => handleToggleCamouflage(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#fafafa' }}>
                    {hasPanicPIN ? 'Ativo' : 'Configurar'}
                  </span>
                </label>
              </div>

              {/* Formulário de Configuração do PIN de Pânico */}
              {(showPanicForm || !hasPanicPIN) && (
                <form
                  onSubmit={handleSavePanicPIN}
                  style={{
                    marginTop: 16,
                    paddingTop: 16,
                    borderTop: '1px solid #27272a',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fafafa' }}>
                    {hasPanicPIN ? 'Alterar PIN Secundário de Pânico (6 dígitos)' : 'Definir PIN Secundário de Pânico (6 dígitos)'}
                  </div>

                  {!hasPIN && (
                    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#93c5fd', fontSize: '0.78rem' }}>
                      Dica: você também pode configurar seu PIN Principal no Painel Geral para alternar entre o Cofre Real (PIN Principal) e o Cofre de Fachada (PIN de Pânico).
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                    <div>
                      <label className="rz-label">PIN DE PÂNICO (6 NÚMEROS)</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Ex: 999999"
                        value={panicPinInput}
                        onChange={(e) => setPanicPinInput(e.target.value.replace(/\D/g, ''))}
                        className="rz-input"
                        required
                      />
                    </div>
                    <div>
                      <label className="rz-label">CONFIRMAR PIN DE PÂNICO</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Repita os 6 dígitos"
                        value={panicPinConfirm}
                        onChange={(e) => setPanicPinConfirm(e.target.value.replace(/\D/g, ''))}
                        className="rz-input"
                        required
                      />
                    </div>
                  </div>

                  {panicError && (
                    <div style={{ color: '#f87171', fontSize: '0.78rem' }}>{panicError}</div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    {showPanicForm && hasPanicPIN && (
                      <button
                        type="button"
                        className="rz-btn rz-btn-secondary"
                        onClick={() => {
                          setShowPanicForm(false);
                          setPanicError(null);
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={savingPanic || panicPinInput.length !== 6 || panicPinConfirm.length !== 6}
                      className="rz-btn rz-btn-primary"
                    >
                      <CheckCircle2 size={15} />
                      <span>{savingPanic ? 'Salvando...' : 'Salvar PIN de Pânico'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Ações quando o PIN de Pânico já está configurado */}
              {hasPanicPIN && !showPanicForm && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid #27272a' }}>
                  <span style={{ fontSize: '0.78rem', color: '#10b981' }}>
                    ✓ PIN de Pânico pronto. Bloqueie o cofre e digite seu PIN de Pânico para testar o Cofre de Fachada.
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="rz-btn rz-btn-secondary"
                      onClick={() => setShowPanicForm(true)}
                    >
                      Alterar PIN de Pânico
                    </button>
                    <button
                      type="button"
                      className="rz-btn rz-btn-primary"
                      onClick={lockApp}
                    >
                      <Lock size={14} />
                      <span>Bloquear Agora e Testar</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* 3. Limpeza da Área de Transferência */}
            <section className="rz-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(16, 185, 129, 0.14)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clipboard size={18} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#fafafa' }}>
                    Autodestruição da Área de Transferência (30s)
                  </h2>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.825rem', color: '#a1a1aa', lineHeight: 1.5 }}>
                    Qualquer credencial copiada do cofre é automaticamente sobrescrita e limpa da memória da área de transferência após 30 segundos.
                  </p>
                </div>
              </div>

              {clipboardDemo && clipboardCountdown > 0 && (
                <div className="clipboard-timer-banner">
                  <div className="clipboard-timer-text">
                    <Clock size={16} />
                    <span>Sobrescrevendo área de transferência em {clipboardCountdown}s</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleClipboardDemo}
                  disabled={clipboardDemo}
                  className="rz-btn rz-btn-secondary"
                  style={{ flex: 1 }}
                >
                  <Clipboard size={15} />
                  <span>Testar Cópia com Autodestruição (30s)</span>
                </button>
                {clipboardDemo && (
                  <button
                    type="button"
                    onClick={handleClearNow}
                    className="rz-btn rz-btn-danger"
                  >
                    <Trash2 size={15} />
                    <span>Limpar Agora</span>
                  </button>
                )}
              </div>
            </section>

            {/* 4. Exportação de Conformidade & Eventos */}
            <section className="rz-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#fafafa' }}>
                    Relatórios de Conformidade (LGPD &amp; ISO/IEC 27001)
                  </h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#a1a1aa' }}>
                    Exporte a trilha de auditoria técnica para validação acadêmica ou corporativa.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={handleExportCSV} className="rz-btn rz-btn-secondary">
                    <FileSpreadsheet size={15} />
                    <span>Exportar CSV</span>
                  </button>
                  <button type="button" onClick={handleExportJSON} className="rz-btn rz-btn-primary">
                    <FileJson size={15} />
                    <span>Exportar JSON (LGPD)</span>
                  </button>
                </div>
              </div>

              {recentLogs.length > 0 && (
                <div className="hardening-logs-wrapper" style={{ marginTop: 12 }}>
                  {recentLogs.map((log) => (
                    <div key={log.id} className="hardening-log-item">
                      <span className="hardening-log-text">{log.details}</span>
                      <span className="hardening-log-time">
                        {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

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
