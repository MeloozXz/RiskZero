import React, { useState, useEffect } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonButton, IonIcon, IonToggle, IonItem, IonLabel,
  IonToast,
} from '@ionic/react';
import {
  eyeOffOutline, clipboardOutline,
  trashOutline, checkmarkCircleOutline, warningOutline,
  phonePortraitOutline, lockClosedOutline, timeOutline,
  documentOutline, downloadOutline,
} from 'ionicons/icons';
import { HardeningService } from '../../services/hardening';
import { ClipboardService } from '../../services/clipboard';
import { StorageService } from '../../services/storage';
import { SessionService } from '../../services/session';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { AuditLog } from '../../types';
import './HardeningPage.css';

export const HardeningPage: React.FC = () => {
  const { canUseCamouflage, isUltra, openUpgradeModal } = useSubscription();
  const [screenshotBlocked, setScreenshotBlocked] = useState(false);
  const [clipboardDemo, setClipboardDemo] = useState(false);
  const [clipboardCountdown, setClipboardCountdown] = useState(0);
  const [isNative, setIsNative] = useState(false);
  const [camouflageEnabled, setCamouflageEnabled] = useState(false);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    setIsNative(HardeningService.isNative());
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
      setToastMsg(isNative
        ? 'Proteção ativada: capturas de tela bloqueadas no dispositivo.'
        : 'Proteção de tela ativada no navegador.'
      );
    } else {
      await HardeningService.disablePrivacyScreen();
      setToastMsg('Proteção de tela desativada.');
    }
    setShowToast(true);
    await loadLogs();
  };

  const handleClipboardDemo = async () => {
    setClipboardDemo(true);
    const demoText = 'SenhaExemplo@123!Demo';
    await ClipboardService.copySecure(
      demoText,
      'Senha Demonstração',
      (msg, timeLeft) => {
        setClipboardCountdown(timeLeft);
        setToastMsg(`Área de transferência limpa em ${timeLeft}s`);
        if (timeLeft === 0) {
          setClipboardDemo(false);
          setShowToast(false);
          loadLogs();
        }
      }
    );
    setToastMsg(`Senha copiada! Ela será apagada da memória em 30s.`);
    setShowToast(true);
  };

  const handleClearNow = async () => {
    await ClipboardService.clearNow();
    setClipboardDemo(false);
    setClipboardCountdown(0);
    setToastMsg('Área de transferência limpa.');
    setShowToast(true);
    await loadLogs();
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
      <IonHeader className="ion-no-border">
        <IonToolbar className="hardening-toolbar">
          <IonTitle className="hardening-title">
            Proteção do Dispositivo
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="hardening-content">
        <div className="hardening-container">

          {/* Status Card */}
          <div className={`hardening-status-banner ${isNative ? 'native' : 'web'}`}>
            <div className="status-banner-content">
              <IonIcon
                icon={isNative ? checkmarkCircleOutline : warningOutline}
                style={{ fontSize: '26px', color: isNative ? '#10b981' : '#fbbf24', filter: `drop-shadow(0 0 8px ${isNative ? 'rgba(16,185,129,0.3)' : 'rgba(251,191,36,0.3)'})` }}
              />
              <div>
                <div className="status-banner-title">
                  {isNative ? 'Segurança Nativa Ativa' : 'Executando em Modo Web'}
                </div>
                <div className="status-banner-desc">
                  {isNative
                    ? 'Proteções nativas ativadas de forma automática.'
                    : 'Instale o aplicativo oficial para ter todas as proteções nativas.'}
                </div>
              </div>
            </div>
          </div>

          {/* Proteção de Screenshots */}
          <IonCard className="hardening-card">
            <IonCardHeader>
              <div className="hardening-card-title-row">
                <IonIcon icon={eyeOffOutline} style={{ color: '#3b82f6', fontSize: '24px' }} />
                <IonCardTitle className="hardening-card-title">
                  Bloqueio de Capturas de Tela
                </IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent>
              <p className="hardening-card-desc">
                Esta função impede que outros aplicativos façam capturas de tela (screenshots) dos seus dados confidenciais e esconde o conteúdo do app no alternador de tarefas.
              </p>
              <IonItem lines="none" className="hardening-toggle-item">
                <IonIcon icon={phonePortraitOutline} slot="start" style={{ color: screenshotBlocked ? '#10b981' : '#7b8499', fontSize: '20px' }} />
                <IonLabel>
                  <h3>Proteger Tela</h3>
                  <p>
                    {screenshotBlocked ? 'Proteção ativada' : 'Proteção desativada'}
                  </p>
                </IonLabel>
                <IonToggle
                  checked={screenshotBlocked}
                  onIonChange={(e) => handleScreenshotToggle(e.detail.checked)}
                  slot="end"
                />
              </IonItem>
              {screenshotBlocked && (
                <div className="hardening-alert-success">
                  Proteção ativa. Ao tentar tirar uma captura de tela, a imagem ficará preta por segurança.
                </div>
              )}
            </IonCardContent>
          </IonCard>

          {/* Auto-Clear do Clipboard */}
          <IonCard className="hardening-card">
            <IonCardHeader>
              <div className="hardening-card-title-row">
                <IonIcon icon={clipboardOutline} style={{ color: '#fbbf24', fontSize: '24px' }} />
                <IonCardTitle className="hardening-card-title">
                  Limpeza da Área de Transferência
                </IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent>
              <p className="hardening-card-desc">
                Qualquer senha copiada do cofre é limpa da área de transferência após 30 segundos, evitando que outros apps maliciosos leiam sua senha.
              </p>

              {clipboardDemo && clipboardCountdown > 0 && (
                <div className="clipboard-timer-banner">
                  <div className="clipboard-timer-text">
                    <IonIcon icon={timeOutline} style={{ fontSize: '18px' }} />
                    <span>Limpando área de transferência em {clipboardCountdown}s</span>
                  </div>
                  <div className="clipboard-timer-indicator" style={{ width: `${(clipboardCountdown / 30) * 100}%` }} />
                </div>
              )}

              <div className="clipboard-actions">
                <IonButton
                  expand="block"
                  onClick={handleClipboardDemo}
                  disabled={clipboardDemo}
                  className="clipboard-btn-demo"
                  fill="clear"
                >
                  <IonIcon icon={clipboardOutline} slot="start" />
                  Testar Copiar Senha
                </IonButton>
                {clipboardDemo && (
                  <IonButton
                    onClick={handleClearNow}
                    className="clipboard-btn-clear"
                    fill="clear"
                  >
                    <IonIcon icon={trashOutline} slot="icon-only" />
                  </IonButton>
                )}
              </div>
            </IonCardContent>
          </IonCard>

          {/* PIN Duplo de Pânico & Modo Camuflagem (Ultra) */}
          <IonCard className="hardening-card" style={{
            border: isUltra ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
            background: isUltra ? 'linear-gradient(180deg, rgba(30, 15, 50, 0.6) 0%, rgba(15, 10, 30, 0.9) 100%)' : undefined,
          }}>
            <IonCardHeader>
              <div className="hardening-card-title-row" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={lockClosedOutline} style={{ color: '#c084fc', fontSize: '24px' }} />
                  <IonCardTitle className="hardening-card-title">
                    PIN de Pânico & Camuflagem
                  </IonCardTitle>
                </div>
                {canUseCamouflage ? (
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#c084fc', background: 'rgba(168, 85, 247, 0.2)', padding: '2px 8px', borderRadius: '8px' }}>
                    Ativo
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => openUpgradeModal('o PIN Duplo de Pânico & Modo Camuflagem', 'ULTRA')}
                    style={{
                      background: 'rgba(168, 85, 247, 0.2)',
                      border: '1px solid rgba(168, 85, 247, 0.5)',
                      borderRadius: '8px',
                      padding: '4px 10px',
                      color: '#e9d5ff',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Requer Ultra
                  </button>
                )}
              </div>
            </IonCardHeader>
            <IonCardContent>
              <p className="hardening-card-desc">
                Em situações de coação, digitar um PIN secundário de pânico abre um cofre de fachada vazio com dados simulados inofensivos, mantendo suas senhas reais ocultas e inacessíveis.
              </p>

              <IonItem lines="none" style={{ '--background': 'transparent', padding: 0 }}>
                <IonLabel style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600 }}>
                  Ativar Modo Camuflagem
                </IonLabel>
                <IonToggle
                  slot="end"
                  checked={camouflageEnabled}
                  disabled={!canUseCamouflage}
                  onIonChange={(e) => {
                    if (!canUseCamouflage) {
                      openUpgradeModal('o PIN Duplo de Pânico & Modo Camuflagem', 'ULTRA');
                      return;
                    }
                    setCamouflageEnabled(e.detail.checked);
                    setToastMsg(e.detail.checked ? 'Modo Camuflagem ativado com sucesso.' : 'Modo Camuflagem desativado.');
                    setShowToast(true);
                  }}
                />
              </IonItem>
            </IonCardContent>
          </IonCard>

          {/* Audit Log Recente */}
          <IonCard className="hardening-card">
            <IonCardHeader>
              <div className="hardening-card-title-row">
                <IonIcon icon={lockClosedOutline} style={{ color: '#06b6d4', fontSize: '24px' }} />
                <IonCardTitle className="hardening-card-title">
                  Últimos Eventos de Segurança
                </IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent style={{ padding: '0 20px 20px' }}>
              {recentLogs.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Nenhum evento registrado no momento.</p>
              ) : (
                <div className="hardening-logs-wrapper">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="hardening-log-item">
                      <span className="hardening-log-text">{log.details}</span>
                      <span className="hardening-log-time">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </IonCardContent>
          </IonCard>

          {/* Exportação de Relatórios de Conformidade */}
          <IonCard className="hardening-card">
            <IonCardHeader>
              <div className="hardening-card-title-row">
                <IonIcon icon={documentOutline} style={{ color: '#a78bfa', fontSize: '24px' }} />
                <IonCardTitle className="hardening-card-title">
                  Relatório de Conformidade
                </IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent>
              <p className="hardening-card-desc">
                Exporte os registros de auditoria de segurança nos formatos CSV ou JSON, em conformidade com a <strong>LGPD (Lei nº 13.709/2018)</strong> e a norma <strong>ISO/IEC 27001:2022</strong>.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
                <IonButton
                  expand="block"
                  onClick={handleExportCSV}
                  style={{
                    '--background': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    fontWeight: 700,
                    flex: 1,
                    minWidth: '140px'
                  }}
                >
                  <IonIcon slot="start" icon={downloadOutline} />
                  Exportar CSV
                </IonButton>
                <IonButton
                  expand="block"
                  onClick={handleExportJSON}
                  style={{
                    '--background': 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
                    fontWeight: 700,
                    flex: 1,
                    minWidth: '140px'
                  }}
                >
                  <IonIcon slot="start" icon={documentOutline} />
                  Exportar JSON (LGPD)
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>
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
