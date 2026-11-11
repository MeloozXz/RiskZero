import React, { useState, useEffect, useCallback } from 'react';
import {
  IonPage,
  IonContent,
  IonToggle,
  IonToast,
  useIonAlert,
} from '@ionic/react';
import {
  Download,
  UploadCloud,
  Trash2,
  Cpu,
  KeyRound,
  AlertTriangle,
  Fingerprint,
  FileSpreadsheet,
  ArrowLeftRight,
  Sparkles,
  ShieldCheck,
  Eye,
  EyeOff,
  ExternalLink,
  RefreshCw,
  Timer,
  ClipboardCheck,
  MonitorOff,
  Puzzle,
  Lock,
  LogOut,
  CheckCircle2,
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';
import { useHistory } from 'react-router-dom';
import { VaultService } from '../../services/vault';
import { StorageService } from '../../services/storage';
import { SessionService } from '../../services/session';
import { ClipboardService } from '../../services/clipboard';
import { ImporterService, ParsedImportItem, SupportedImportFormat } from '../../services/importer';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PageHeader } from '../../components/ui/PageHeader';
import { MasterKeyModal } from '../../components/MasterKeyModal';
import { useSecurity } from '../../contexts/SecurityContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { ActiveSession } from '../../types';
import './SettingsPage.css';

export const SettingsPage: React.FC = () => {
  const history = useHistory();
  const {
    logout,
    lockApp,
    activeEmail,
    isBiometricsEnrolled,
    registerBiometrics,
    disableBiometrics,
    rememberSession,
    setRememberSession,
    totpEnabled,
    setupNew2FA,
    enable2FA,
    disable2FA,
  } = useSecurity();
  const { tier, subscription, isPro, isUltra } = useSubscription();
  const [presentAlert] = useIonAlert();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<string>('');

  // Preferências locais de Hardening (Auto-Lock, Clipboard, Privacy Screen)
  const [autoLockMinutes, setAutoLockMinutes] = useState<string>(
    () => localStorage.getItem('rz_autolock_minutes') || '5'
  );
  const [clipboardSeconds, setClipboardSeconds] = useState<string>(
    () => localStorage.getItem('rz_clipboard_seconds') || '30'
  );
  const [privacyScreenEnabled, setPrivacyScreenEnabled] = useState<boolean>(
    () => localStorage.getItem('rz_privacy_screen') !== 'false'
  );
  const [showMasterKeyModal, setShowMasterKeyModal] = useState<boolean>(false);

  // Estados para Restauração de Backup JSON
  const [backupText, setBackupText] = useState<string>('');
  const [backupPassword, setBackupPassword] = useState<string>('');
  const [mergeBackup, setMergeBackup] = useState<boolean>(true);
  const [fileSelected, setFileSelected] = useState<string>('');

  // Estados para Importação CSV / Bitwarden / 1Password / Chrome
  const [csvFileSelected, setCsvFileSelected] = useState<string>('');
  const [csvFormat, setCsvFormat] = useState<SupportedImportFormat | null>(null);
  const [csvItems, setCsvItems] = useState<ParsedImportItem[]>([]);
  const [isImportingCSV, setIsImportingCSV] = useState<boolean>(false);

  // Estados para Exclusão Total
  const [confirmWipePassword, setConfirmWipePassword] = useState<string>('');
  const [showWipeConfirmModal, setShowWipeConfirmModal] = useState<boolean>(false);

  // Estado para Confirmação de Biometria
  const [bioPassword, setBioPassword] = useState<string>('');

  // Estados para API Key do Have I Been Pwned (HIBP)
  const [hibpKey, setHibpKey] = useState<string>('');
  const [showHibpKey, setShowHibpKey] = useState<boolean>(false);
  const [hasSavedHibpKey, setHasSavedHibpKey] = useState<boolean>(false);
  const [isSavingHibpKey, setIsSavingHibpKey] = useState<boolean>(false);

  // Estados para Feedbacks
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastColor, setToastColor] = useState<string>('dark');

  const detectDeviceInfo = () => {
    const ua = navigator.userAgent;
    let OS = 'Desconhecido';
    if (ua.indexOf('Android') !== -1) OS = 'Android OS';
    else if (ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1) OS = 'iOS (Apple)';
    else if (ua.indexOf('Windows') !== -1) OS = 'Windows PC';
    else if (ua.indexOf('Macintosh') !== -1) OS = 'macOS';
    else if (ua.indexOf('Linux') !== -1) OS = 'Linux PC';

    setDeviceInfo(`${OS} - ${navigator.language}`);
  };

  const loadSessions = useCallback(async () => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    const stored = await StorageService.getAuditLogs(email);
    const logins = stored.filter((log) => log.action === 'LOGIN_SUCCESS');

    const sessionsList: ActiveSession[] = logins.map((log, index) => {
      const isCurrent = index === 0;
      return {
        id: log.id,
        deviceName: isCurrent ? `Este dispositivo (${deviceInfo || 'Celular'})` : 'Dispositivo anterior',
        lastActive: log.timestamp,
        ipPlaceholder: isCurrent ? 'Conexão ativa' : 'Acesso registrado',
      };
    });

    if (sessionsList.length === 0) {
      sessionsList.push({
        id: 'current',
        deviceName: `Este Dispositivo (${navigator.platform})`,
        lastActive: new Date().toISOString(),
        ipPlaceholder: 'Conexão ativa',
      });
    }

    setSessions(sessionsList.slice(0, 4));
  }, [deviceInfo]);

  useEffect(() => {
    loadSessions();
    detectDeviceInfo();
    StorageService.getHibpApiKey().then((key) => {
      if (key) {
        setHibpKey(key);
        setHasSavedHibpKey(true);
      }
    });
  }, [loadSessions]);

  const showFeedback = (msg: string, color: string = 'dark') => {
    setToastMsg(msg);
    setToastColor(color);
    setShowToast(true);
  };

  const handleSaveHibpKey = async () => {
    const trimmed = hibpKey.trim();
    if (!trimmed) {
      showFeedback('Por favor, informe uma API Key válida do Have I Been Pwned.', 'warning');
      return;
    }
    setIsSavingHibpKey(true);
    try {
      await StorageService.setHibpApiKey(trimmed);
      setHasSavedHibpKey(true);
      showFeedback('Chave de API do HIBP salva neste dispositivo.', 'success');
    } catch {
      showFeedback('Erro ao salvar a chave localmente.', 'danger');
    } finally {
      setIsSavingHibpKey(false);
    }
  };

  const handleClearHibpKey = async () => {
    try {
      await StorageService.clearHibpApiKey();
      setHibpKey('');
      setHasSavedHibpKey(false);
      showFeedback('Chave do HIBP removida. A verificação retornará ao modo simulação.', 'warning');
    } catch {
      showFeedback('Erro ao remover a chave do HIBP.', 'danger');
    }
  };

  // Exportar Backup Seguro
  const handleExportBackup = async () => {
    try {
      const blobStr = await VaultService.exportEncryptedBlob();
      const blob = new Blob([blobStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-seguro-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showFeedback('Backup exportado.', 'success');
    } catch {
      showFeedback('Não foi possível exportar o backup. Tente novamente.', 'danger');
    }
  };

  // Ler arquivo carregado
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileSelected(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setBackupText(text);
    };
    reader.readAsText(file);
  };

  // Restaurar Backup
  const handleImportBackup = async () => {
    if (!backupText.trim()) {
      showFeedback('Selecione um arquivo de backup para continuar.', 'warning');
      return;
    }
    if (!backupPassword.trim()) {
      showFeedback('Informe a senha mestra que foi usada para criar este backup.', 'warning');
      return;
    }

    try {
      const res = await VaultService.importEncryptedBlob(backupText, backupPassword, mergeBackup);
      if (res.success) {
        showFeedback(`Backup restaurado: ${res.importedCount} credenciais recuperadas.`, 'success');
        setBackupText('');
        setBackupPassword('');
        setFileSelected('');
        loadSessions();
      }
    } catch {
      showFeedback('Não foi possível restaurar o backup. Verifique a senha e tente novamente.', 'danger');
    }
  };

  // Ler arquivo CSV para migração
  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileSelected(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const { format, items } = ImporterService.parseCSVToItems(text);
        setCsvFormat(format);
        setCsvItems(items);
        showFeedback(`Formato reconhecido: ${format} (${items.length} itens).`, 'success');
      } catch {
        showFeedback('Erro ao processar o arquivo CSV.', 'danger');
        setCsvItems([]);
      }
    };
    reader.readAsText(file);
  };

  // Confirmar importação do CSV
  const handleConfirmCSVImport = async () => {
    if (csvItems.length === 0) {
      showFeedback('Nenhum item disponível para importar.', 'warning');
      return;
    }

    setIsImportingCSV(true);
    try {
      const res = await ImporterService.importItemsToVault(csvItems);
      showFeedback(`${res.importedCount} credenciais importadas e criptografadas no cofre.`, 'success');
      setCsvFileSelected('');
      setCsvItems([]);
      setCsvFormat(null);
      loadSessions();
    } catch {
      showFeedback('Falha ao importar itens para o cofre.', 'danger');
    } finally {
      setIsImportingCSV(false);
    }
  };

  // Exportar Cofre em formato CSV (com reautenticação obrigatória - A-5)
  const handleExportCSV = async () => {
    presentAlert({
      header: 'Exportar Cofre (CSV)',
      subHeader: 'Reautenticação de Segurança',
      message: 'Por motivos de segurança (Zero-Knowledge), confirme sua Senha Mestra para decifrar e exportar o cofre em texto claro.',
      inputs: [
        {
          name: 'masterPassword',
          type: 'password',
          placeholder: 'Sua Senha Mestra',
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Confirmar e Exportar',
          handler: async (data) => {
            const pwd = data?.masterPassword;
            if (!pwd) {
              showFeedback('Senha Mestra obrigatória para exportação.', 'warning');
              return false;
            }
            try {
              const csvStr = await ImporterService.exportVaultToCSV(pwd);
              const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);

              const link = document.createElement('a');
              link.href = url;
              link.download = `cofre-exportado-${new Date().toISOString().slice(0, 10)}.csv`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);

              showFeedback('Arquivo CSV exportado.', 'success');
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Não foi possível exportar o CSV.';
              showFeedback(msg, 'danger');
            }
          },
        },
      ],
    });
  };

  // Exclusão Total da Conta
  const handleWipeData = async () => {
    if (!confirmWipePassword.trim()) {
      showFeedback('Confirme sua senha mestra para prosseguir.', 'warning');
      return;
    }

    const email = SessionService.getActiveUserEmail();
    if (!email) return;

    const profile = await StorageService.getUserProfile(email);
    if (!profile) return;

    try {
      const authRes = await SessionService.authenticateMaster(email, confirmWipePassword);
      if (authRes.success) {
        setShowWipeConfirmModal(true);
      } else {
        showFeedback('Senha mestra incorreta. A operação foi cancelada.', 'danger');
      }
    } catch {
      showFeedback('Não foi possível confirmar sua identidade. Tente novamente.', 'danger');
    }
  };

  const handleExecuteWipe = async () => {
    setShowWipeConfirmModal(false);
    await StorageService.clearAllData();
    SessionService.clearSession();
    showFeedback('Todos os dados foram excluídos deste dispositivo.', 'danger');
    setTimeout(() => {
      logout();
    }, 1500);
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (sessionId === 'current' || sessions[0]?.id === sessionId) {
      showFeedback('Não é possível desconectar o dispositivo que você está usando agora.', 'warning');
      return;
    }
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    await StorageService.addAuditLog(email, 'PIN_LOCKED', `Dispositivo [${sessionId.substring(0, 6)}] desconectado.`);
    showFeedback('Dispositivo desconectado com sucesso.', 'success');
  };

  const handleDownloadExtensionInfo = () => {
    showFeedback('Pacote WebExtension (Manifest V3) disponível no diretório /browser-extension do projeto.', 'success');
  };

  // Estados e Ações para 2FA (Google Authenticator / TOTP)
  const [show2FASetup, setShow2FASetup] = useState<boolean>(false);
  const [currentLocalSecret, setCurrentLocalSecret] = useState<string | null>(null);
  const [totpTokenInput, setTotpTokenInput] = useState<string>('');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [showDisable2FAConfirm, setShowDisable2FAConfirm] = useState<boolean>(false);
  const [isVerifying2FA, setIsVerifying2FA] = useState<boolean>(false);

  const handleStart2FA = () => {
    setMfaError(null);
    setTotpTokenInput('');
    const secret = setupNew2FA();
    setCurrentLocalSecret(secret);
    setShow2FASetup(true);
  };

  const handleCopySecret = async (secret: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(secret);
      } else {
        await ClipboardService.copySecure(secret, 'Chave secreta 2FA');
      }
      showFeedback('Chave Base32 copiada para a área de transferência.', 'success');
    } catch {
      showFeedback('Chave selecionada.', 'info');
    }
  };

  const handleConfirm2FA = async () => {
    if (totpTokenInput.length !== 6 || isNaN(Number(totpTokenInput))) {
      setMfaError('O código deve conter 6 dígitos numéricos.');
      return;
    }
    setMfaError(null);
    setIsVerifying2FA(true);
    try {
      const res = await enable2FA(totpTokenInput);
      if (res.success) {
        setTotpTokenInput('');
        setCurrentLocalSecret(null);
        setShow2FASetup(false);
        showFeedback('Autenticação em duas etapas (Google Authenticator) ativada com sucesso.', 'success');
      } else {
        setMfaError(res.error || 'Código 2FA incorreto ou expirado. Tente novamente.');
      }
    } catch {
      setMfaError('Erro ao validar o código 2FA.');
    } finally {
      setIsVerifying2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    try {
      await disable2FA();
      setShowDisable2FAConfirm(false);
      showFeedback('Autenticação em dois fatores desativada.', 'info');
    } catch {
      showFeedback('Erro ao desativar 2FA.', 'danger');
    }
  };

  const enrolledBio = activeEmail ? isBiometricsEnrolled(activeEmail) : false;

  return (
    <IonPage className="rz-page settings-page">
      <IonContent className="rz-content settings-content">
        <div className="rz-container">
          <PageHeader
            eyebrow="Sistema & Governança"
            title="Configurações"
            subtitle="Gerencie políticas de sessão, biometria FIDO2, backups criptografados Zero-Knowledge e ciclo de vida dos seus dados."
            actions={
              <>
                <button
                  type="button"
                  className="rz-btn rz-btn-secondary"
                  onClick={() => {
                    lockApp();
                    showFeedback('Cofre bloqueado manualmente.', 'success');
                  }}
                >
                  <Lock size={16} />
                  <span>Bloquear Agora</span>
                </button>
                <button
                  type="button"
                  className="rz-btn rz-btn-ghost"
                  onClick={() => logout()}
                >
                  <LogOut size={16} />
                  <span>Encerrar Sessão</span>
                </button>
              </>
            }
          />

          <div className="rz-settings-grid">
            {/* ════════════════════════════════════════════════════════════════
                COLUNA ESQUERDA: PLANO, SESSÃO/HARDENING, BIOMETRIA, HIBP
               ════════════════════════════════════════════════════════════════ */}
            <div className="rz-settings-col">
              {/* 1. Meu Plano & Assinatura */}
              <section className="rz-section" style={{ marginBottom: 0 }}>
                <div className="rz-section-head">
                  <h2 className="rz-section-title">
                    <Sparkles size={16} />
                    Licenciamento &amp; Plano
                  </h2>
                  <span
                    className={`rz-badge ${
                      isUltra ? 'rz-badge-violet' : isPro ? 'rz-badge-info' : 'rz-badge-neutral'
                    }`}
                  >
                    {tier === 'ULTRA' ? 'ULTRA' : tier === 'PRO' ? 'PRO' : 'FREE'}
                  </span>
                </div>

                <div
                  className={`rz-panel ${
                    isUltra ? 'rz-panel-premium' : isPro ? 'rz-panel-accent' : ''
                  }`}
                >
                  <div className="rz-card-header">
                    <div className="rz-card-title-group">
                      <div className={`rz-icon-tile ${isUltra ? 'violet' : ''}`}>
                        <Sparkles />
                      </div>
                      <div>
                        <h3 className="rz-card-title">Meu Plano &amp; Assinatura</h3>
                        <span className="rz-row-meta">
                          {activeEmail || 'Conta Zero-Knowledge ativa'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="rz-text-muted" style={{ marginBottom: '14px' }}>
                    {isUltra
                      ? 'Você possui o plano Ultra Familiar com proteção absoluta, até 6 membros, PIN de Pânico e armazenamento de 10 GB.'
                      : isPro
                        ? 'Você possui o plano Pro com 2FA ilimitado, até 5 dispositivos e monitoramento Dark Web diário.'
                        : 'Você está no plano Gratuito com senhas ilimitadas em 1 dispositivo. Faça upgrade para desbloquear 2FA e múltiplos aparelhos.'}
                  </p>

                  {subscription?.expiresAt && (
                    <div className="rz-setting-row" style={{ paddingTop: '8px', paddingBottom: '12px' }}>
                      <span className="rz-setting-desc">Próxima renovação</span>
                      <span className="rz-stat-value-sm">
                        {new Date(subscription.expiresAt).toLocaleDateString()} (
                        {subscription.billingCycle === 'ANNUAL' ? 'Plano Anual' : 'Plano Mensal'})
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => history.push('/plans')}
                    className={`rz-btn rz-btn-block ${
                      isUltra ? 'rz-btn-premium' : 'rz-btn-primary'
                    }`}
                  >
                    <Sparkles size={16} />
                    <span>
                      {tier === 'FREE' ? 'Fazer upgrade de plano' : 'Gerenciar / Mudar de Plano'}
                    </span>
                  </button>
                </div>
              </section>

              {/* 2. Políticas de Sessão & Hardening */}
              <section className="rz-section" style={{ marginBottom: 0 }}>
                <div className="rz-section-head">
                  <h2 className="rz-section-title">
                    <RefreshCw size={16} />
                    Políticas de Sessão &amp; Hardening
                  </h2>
                </div>

                <div className="rz-panel">
                  {/* Persistência de Sessão (F5) */}
                  <div className="rz-setting-row">
                    <div className="rz-setting-info">
                      <div className="rz-setting-title">Manter Conectado ao Atualizar (F5)</div>
                      <p className="rz-setting-desc">
                        {rememberSession
                          ? 'Ativado: Sessão protegida por salt de dispositivo e restaurada ao atualizar.'
                          : 'Desativado: Sessão estritamente volátil em RAM. Recarregar encerra o acesso.'}
                      </p>
                    </div>
                    <div className="rz-setting-control">
                      <IonToggle
                        checked={rememberSession}
                        onIonChange={async (e) => {
                          const enabled = e.detail.checked;
                          await setRememberSession(enabled);
                          showFeedback(
                            enabled
                              ? 'Sessão persistente ativada. Você continuará conectado ao recarregar a página.'
                              : 'Sessão temporária ativada (apenas RAM). Ao atualizar ou fechar a aba, o login será solicitado.',
                            enabled ? 'success' : 'warning'
                          );
                        }}
                      />
                    </div>
                  </div>

                  {/* Timer de Auto-Lock */}
                  <div className="rz-setting-row is-stackable">
                    <div className="rz-setting-info">
                      <div className="rz-setting-title">Timer de Auto-Lock por Inatividade</div>
                      <p className="rz-setting-desc">
                        Bloqueia automaticamente o cofre na ausência de interação ou ao ocultar a aba.
                      </p>
                    </div>
                    <div className="rz-setting-control">
                      <Timer size={16} style={{ color: 'var(--rz-text-muted)' }} />
                      <select
                        aria-label="Timer de Auto-Lock"
                        className="rz-select-inline"
                        value={autoLockMinutes}
                        onChange={(e) => {
                          setAutoLockMinutes(e.target.value);
                          localStorage.setItem('rz_autolock_minutes', e.target.value);
                          showFeedback(`Timer de Auto-Lock ajustado para ${e.target.value} min.`, 'success');
                        }}
                      >
                        <option value="1">1 minuto</option>
                        <option value="5">5 minutos (Padrão)</option>
                        <option value="15">15 minutos</option>
                        <option value="0">Imediato ao minimizar</option>
                      </select>
                    </div>
                  </div>

                  {/* Hardening de Clipboard */}
                  <div className="rz-setting-row is-stackable">
                    <div className="rz-setting-info">
                      <div className="rz-setting-title">Limpeza da Área de Transferência</div>
                      <p className="rz-setting-desc">
                        Apaga senhas e chaves PIX copiadas após o tempo limite estipulado.
                      </p>
                    </div>
                    <div className="rz-setting-control">
                      <select
                        aria-label="Tempo de limpeza da área de transferência"
                        className="rz-select-inline"
                        value={clipboardSeconds}
                        onChange={(e) => {
                          setClipboardSeconds(e.target.value);
                          localStorage.setItem('rz_clipboard_seconds', e.target.value);
                          showFeedback(`Auto-clear do clipboard definido para ${e.target.value}s.`, 'success');
                        }}
                      >
                        <option value="15">15 segundos</option>
                        <option value="30">30 segundos (Padrão)</option>
                        <option value="60">60 segundos</option>
                      </select>
                      <button
                        type="button"
                        className="rz-btn rz-btn-sm rz-btn-secondary"
                        onClick={async () => {
                          await ClipboardService.clearNow();
                          showFeedback('Área de transferência limpa.', 'success');
                        }}
                        title="Limpar área de transferência agora"
                      >
                        <ClipboardCheck size={14} />
                        <span>Limpar</span>
                      </button>
                    </div>
                  </div>

                  {/* Privacy Screen */}
                  <div className="rz-setting-row">
                    <div className="rz-setting-info">
                      <div className="rz-setting-title">Tela de Privacidade (Anti-Screenshot)</div>
                      <p className="rz-setting-desc">
                        Oculta a pré-visualização no multitarefas Android e bloqueia capturas de tela.
                      </p>
                    </div>
                    <div className="rz-setting-control">
                      <MonitorOff size={16} style={{ color: 'var(--rz-text-muted)' }} />
                      <IonToggle
                        checked={privacyScreenEnabled}
                        onIonChange={(e) => {
                          const checked = e.detail.checked;
                          setPrivacyScreenEnabled(checked);
                          localStorage.setItem('rz_privacy_screen', String(checked));
                          showFeedback(
                            checked
                              ? 'Proteção de tela (FLAG_SECURE) ativada.'
                              : 'Proteção de tela desativada.',
                            checked ? 'success' : 'warning'
                          );
                        }}
                      />
                    </div>
                  </div>

                  {/* Extensão Autofill */}
                  <div className="rz-setting-row is-stackable">
                    <div className="rz-setting-info">
                      <div className="rz-setting-title">Extensão Web de Preenchimento (Autofill)</div>
                      <p className="rz-setting-desc">
                        Integração Manifest V3 para navegadores Chromium/Firefox com verificação de domínio.
                      </p>
                    </div>
                    <div className="rz-setting-control">
                      <button
                        type="button"
                        onClick={handleDownloadExtensionInfo}
                        className="rz-btn rz-btn-sm rz-btn-secondary"
                      >
                        <Puzzle size={14} />
                        <span>Obter Extensão</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. Biometria (Touch ID / Face ID / Windows Hello) & Chave Mestra */}
              <section className="rz-section" style={{ marginBottom: 0 }}>
                <div className="rz-section-head">
                  <h2 className="rz-section-title">
                    <Fingerprint size={16} />
                    Biometria &amp; Chave Mestra
                  </h2>
                  <span className={`rz-badge ${enrolledBio ? 'rz-badge-success' : 'rz-badge-neutral'}`}>
                    {enrolledBio ? 'Vinculada' : 'Não configurada'}
                  </span>
                </div>

                <div className="rz-panel">
                  <div className="rz-card-header">
                    <div className="rz-card-title-group">
                      <div className={`rz-icon-tile ${enrolledBio ? 'success' : ''}`}>
                        <Fingerprint />
                      </div>
                      <div>
                        <h3 className="rz-card-title">Biometria (Touch ID / Face ID)</h3>
                        <span className="rz-row-meta">Autenticação FIDO2 / WebAuthn de hardware</span>
                      </div>
                    </div>
                  </div>

                  <p className="rz-text-muted" style={{ marginBottom: '16px' }}>
                    Ative o desbloqueio biométrico para acessar seu cofre rapidamente ou recuperar sua senha mestra localmente caso a esqueça.
                  </p>

                  {enrolledBio ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div className="rz-alert rz-alert-success">
                        <CheckCircle2 size={18} />
                        <span>Biometria ativa neste dispositivo</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => history.push('/biometric-settings')}
                          className="rz-btn rz-btn-primary"
                          style={{ flex: 1 }}
                        >
                          <Fingerprint size={16} />
                          <span>Painel de Biometria &amp; Chave Mestra</span>
                        </button>
                        <button
                          type="button"
                          className="rz-btn rz-btn-danger"
                          onClick={() => {
                            disableBiometrics();
                            showFeedback('Biometria desativada com sucesso.', 'success');
                          }}
                        >
                          <Trash2 size={16} />
                          <span>Desativar Biometria</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={() => history.push('/biometric-settings')}
                        className="rz-btn rz-btn-secondary rz-btn-block"
                      >
                        <Fingerprint size={16} />
                        <span>Painel Avançado de Biometria &amp; Chave Mestra</span>
                      </button>

                      <div
                        style={{
                          background: 'var(--rz-bg-deep)',
                          padding: '14px',
                          borderRadius: 'var(--rz-radius-sm)',
                          border: '1px solid var(--rz-border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <span className="rz-stat-label" style={{ marginBottom: 0 }}>
                          CADASTRAR BIOMETRIA (DIGITAL / ROSTO):
                        </span>
                        <div className="rz-input-group">
                          <KeyRound size={17} />
                          <input
                            type="password"
                            className="rz-input"
                            placeholder="Digite sua Senha Mestra"
                            value={bioPassword}
                            onChange={(e) => setBioPassword(e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className="rz-btn rz-btn-primary rz-btn-block"
                          onClick={async () => {
                            if (!bioPassword.trim()) {
                              showFeedback('Por favor, informe sua senha mestra para prosseguir.', 'warning');
                              return;
                            }
                            const res = await registerBiometrics(bioPassword);
                            if (res.success) {
                              showFeedback('Biometria ativada.', 'success');
                              setBioPassword('');
                            } else {
                              showFeedback(res.error || 'Erro ao ativar biometria.', 'danger');
                            }
                          }}
                        >
                          <Fingerprint size={16} />
                          <span>Cadastrar e ativar biometria</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <hr className="rz-divider" style={{ margin: '16px 0' }} />

                  <div className="rz-setting-row" style={{ padding: 0, borderBottom: 0 }}>
                    <div className="rz-setting-info">
                      <div className="rz-setting-title">Rotação da Senha Mestra</div>
                      <p className="rz-setting-desc">
                        Recriptografa a DEK do cofre com novo salt Argon2id.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMasterKeyModal(true)}
                      className="rz-btn rz-btn-sm rz-btn-secondary"
                    >
                      <KeyRound size={14} />
                      <span>Redefinir Chave</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* 4. Segundo Fator (2FA / Google Authenticator) */}
              <section className="rz-section" style={{ marginBottom: 0 }}>
                <div className="rz-section-head">
                  <h2 className="rz-section-title">
                    <Smartphone size={16} />
                    Segundo Fator (2FA / Google Authenticator)
                  </h2>
                  <span className={`rz-badge ${totpEnabled ? 'rz-badge-success' : 'rz-badge-neutral'}`}>
                    {totpEnabled ? 'Ativado' : 'Não configurado'}
                  </span>
                </div>

                <div className="rz-panel">
                  <div className="rz-card-header">
                    <div className="rz-card-title-group">
                      <div className={`rz-icon-tile ${totpEnabled ? 'success' : ''}`}>
                        <Smartphone />
                      </div>
                      <div>
                        <h3 className="rz-card-title">Google Authenticator (TOTP)</h3>
                        <span className="rz-row-meta">Padrão RFC 6238 · Códigos rotativos a cada 30s</span>
                      </div>
                    </div>
                  </div>

                  {totpEnabled ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="rz-alert rz-alert-success">
                        <CheckCircle2 size={18} />
                        <span>
                          <strong>Proteção 2FA Ativa:</strong> seu cofre exige o código gerado pelo Google Authenticator a cada novo login.
                        </span>
                      </div>
                      <p className="rz-text-muted" style={{ margin: 0 }}>
                        Compatível com Google Authenticator, Microsoft Authenticator, Authy e 1Password.
                      </p>
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowDisable2FAConfirm(true)}
                          className="rz-btn rz-btn-danger"
                        >
                          <Trash2 size={16} />
                          <span>Desativar 2FA</span>
                        </button>
                      </div>
                    </div>
                  ) : !show2FASetup ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <p className="rz-text-muted" style={{ margin: 0 }}>
                        Adicione uma camada extra de segurança blindada vinculando o <strong>Google Authenticator</strong>. Mesmo que sua senha seja descoberta, ninguém conseguirá entrar sem o código temporário de 6 dígitos gerado no seu celular.
                      </p>
                      <div>
                        <button
                          type="button"
                          onClick={handleStart2FA}
                          className="rz-btn rz-btn-primary"
                        >
                          <Smartphone size={16} />
                          <span>Configurar Google Authenticator</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <p className="rz-text-muted" style={{ margin: 0 }}>
                        1. Abra o <strong>Google Authenticator</strong> no seu celular e escaneie o QR Code abaixo (ou insira a chave manualmente):
                      </p>

                      <div className="settings-2fa-qr-box">
                        {currentLocalSecret && (
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                              `otpauth://totp/RiskZero:${encodeURIComponent(activeEmail || 'usuario')}?secret=${currentLocalSecret}&issuer=RiskZero`
                            )}`}
                            alt="QR Code Google Authenticator"
                            className="settings-2fa-qr-img"
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span className="rz-stat-label" style={{ marginBottom: 4 }}>
                            CHAVE SECRETA (BASE32):
                          </span>
                          <code className="settings-2fa-secret-code">{currentLocalSecret}</code>
                          <button
                            type="button"
                            className="rz-btn rz-btn-secondary rz-btn-sm"
                            onClick={() => currentLocalSecret && handleCopySecret(currentLocalSecret)}
                          >
                            <Copy size={13} />
                            <span>Copiar Chave</span>
                          </button>
                        </div>
                      </div>

                      <p className="rz-text-muted" style={{ margin: 0 }}>
                        2. Digite o código de 6 dígitos exibido no seu aplicativo para confirmar e ativar:
                      </p>

                      <div className="settings-2fa-verify-row">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Ex: 123456"
                          value={totpTokenInput}
                          onChange={(e) => setTotpTokenInput(e.target.value.replace(/\D/g, ''))}
                          className="rz-input is-mono"
                          style={{ maxWidth: 200, letterSpacing: '0.15em', textAlign: 'center', fontSize: '1.1rem' }}
                        />
                        <button
                          type="button"
                          onClick={handleConfirm2FA}
                          disabled={totpTokenInput.length !== 6 || isVerifying2FA}
                          className="rz-btn rz-btn-primary"
                        >
                          <Check size={16} />
                          <span>{isVerifying2FA ? 'Validando...' : 'Ativar Proteção'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShow2FASetup(false);
                            setCurrentLocalSecret(null);
                            setTotpTokenInput('');
                            setMfaError(null);
                          }}
                          className="rz-btn rz-btn-secondary"
                        >
                          <span>Cancelar</span>
                        </button>
                      </div>

                      {mfaError && (
                        <div className="rz-alert rz-alert-danger" style={{ margin: 0 }}>
                          <AlertTriangle size={16} />
                          <span>{mfaError}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* 5. Auditoria de E-mails (Have I Been Pwned API v3) */}
              <section className="rz-section" style={{ marginBottom: 0 }}>
                <div className="rz-section-head">
                  <h2 className="rz-section-title">
                    <ShieldCheck size={16} />
                    Auditoria de E-mails (Have I Been Pwned)
                  </h2>
                  <span className={`rz-badge ${hasSavedHibpKey ? 'rz-badge-success' : 'rz-badge-warning'}`}>
                    {hasSavedHibpKey ? 'Configurada' : 'Simulação'}
                  </span>
                </div>

                <div className="rz-panel">
                  <p className="rz-text-muted" style={{ marginBottom: '14px' }}>
                    Conecte sua API Key pessoal da v3 do <strong>Have I Been Pwned</strong> para auditar vazamentos reais de e-mails em tempo real.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <span className="rz-stat-label" style={{ marginBottom: 0 }}>
                        CHAVE DE API PESSOAL (HIBP-API-KEY):
                      </span>
                      <a
                        href="https://haveibeenpwned.com/API/Key"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: 'var(--rz-ice)',
                          fontSize: 'var(--rz-text-xs)',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          textDecoration: 'none',
                        }}
                      >
                        Obter Chave HIBP <ExternalLink size={12} />
                      </a>
                    </div>

                    <div className="rz-input-group">
                      <KeyRound size={17} />
                      <input
                        type={showHibpKey ? 'text' : 'password'}
                        className="rz-input is-mono"
                        placeholder="Insira sua chave HIBP (Ex: a1b2c3d4...)"
                        value={hibpKey}
                        onChange={(e) => setHibpKey(e.target.value)}
                      />
                      <button
                        type="button"
                        className="rz-icon-btn"
                        onClick={() => setShowHibpKey(!showHibpKey)}
                        aria-label={showHibpKey ? 'Ocultar chave HIBP' : 'Mostrar chave HIBP'}
                      >
                        {showHibpKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    <div className="rz-alert rz-alert-info">
                      <ShieldCheck size={16} />
                      <span>
                        <strong>Privacidade:</strong> Sua chave é armazenada exclusivamente na memória segura deste dispositivo e nunca é enviada ao Firestore ou à nuvem.
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="rz-btn rz-btn-primary"
                        disabled={isSavingHibpKey || !hibpKey.trim()}
                        onClick={handleSaveHibpKey}
                        style={{ flex: 1 }}
                      >
                        <span>{isSavingHibpKey ? 'Salvando...' : 'Salvar Chave'}</span>
                      </button>

                      {hasSavedHibpKey && (
                        <button
                          type="button"
                          className="rz-btn rz-btn-danger"
                          onClick={handleClearHibpKey}
                          aria-label="Remover chave HIBP"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                COLUNA DIREITA: BACKUP, MIGRAÇÃO CSV, SESSÕES, ZONA DE RISCO
               ════════════════════════════════════════════════════════════════ */}
            <div className="rz-settings-col">
              {/* 5. Backup Criptografado */}
              <section className="rz-section" style={{ marginBottom: 0 }}>
                <div className="rz-section-head">
                  <h2 className="rz-section-title">
                    <Download size={16} />
                    Backup Seguro (AES-256-GCM)
                  </h2>
                </div>

                <div className="rz-panel">
                  <p className="rz-text-muted" style={{ marginBottom: '14px' }}>
                    Salve uma cópia protegida das suas credenciais. O arquivo é totalmente criptografado e só pode ser aberto com a sua senha mestra.
                  </p>

                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="rz-btn rz-btn-primary rz-btn-block"
                  >
                    <Download size={16} />
                    <span>Baixar Backup</span>
                  </button>

                  <hr className="rz-divider" />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h3 className="rz-card-title" style={{ fontSize: '0.95rem' }}>
                      Restaurar Backup
                    </h3>

                    <div className="file-picker-wrapper">
                      <input
                        type="file"
                        accept=".json"
                        id="backup-file-input"
                        onChange={handleFileChange}
                        className="file-picker-input"
                      />
                      <button
                        type="button"
                        className="rz-btn rz-btn-secondary rz-btn-block"
                      >
                        <UploadCloud size={16} />
                        <span>
                          {fileSelected ? `Arquivo: ${fileSelected}` : 'Selecionar Arquivo .json'}
                        </span>
                      </button>
                    </div>

                    {backupText && (
                      <div className="rz-enter" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                        <div className="rz-input-group">
                          <KeyRound size={17} />
                          <input
                            type="password"
                            className="rz-input"
                            placeholder="Senha Mestra do Backup"
                            value={backupPassword}
                            onChange={(e) => setBackupPassword(e.target.value)}
                          />
                        </div>

                        <div className="rz-setting-row" style={{ padding: '6px 0' }}>
                          <span className="rz-setting-desc">Mesclar com itens existentes?</span>
                          <IonToggle
                            checked={mergeBackup}
                            onIonChange={(e) => setMergeBackup(e.detail.checked)}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleImportBackup}
                          className="rz-btn rz-btn-success rz-btn-block"
                        >
                          <CheckCircle2 size={16} />
                          <span>Restaurar Credenciais</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* 6. Migração & Importação Universal */}
              <section className="rz-section" style={{ marginBottom: 0 }}>
                <div className="rz-section-head">
                  <h2 className="rz-section-title">
                    <ArrowLeftRight size={16} />
                    Migração Universal (Bitwarden / 1Password / Chrome / CSV)
                  </h2>
                </div>

                <div className="rz-panel">
                  <p className="rz-text-muted" style={{ marginBottom: '14px' }}>
                    Importe suas credenciais de outros gerenciadores com detecção automática de colunas e cifragem Zero-Knowledge instantânea no seu aparelho.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="file-picker-wrapper">
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        id="csv-file-input"
                        onChange={handleCSVFileChange}
                        className="file-picker-input"
                      />
                      <button
                        type="button"
                        className="rz-btn rz-btn-secondary rz-btn-block"
                      >
                        <FileSpreadsheet size={16} />
                        <span>
                          {csvFileSelected ? `CSV: ${csvFileSelected}` : 'Selecionar Arquivo .csv'}
                        </span>
                      </button>
                    </div>

                    {csvItems.length > 0 && (
                      <div
                        style={{
                          background: 'var(--rz-bg-deep)',
                          border: '1px solid var(--rz-accent-line)',
                          borderRadius: 'var(--rz-radius-sm)',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="rz-setting-desc">Formato Detectado:</span>
                          <span className="rz-badge rz-badge-info">{csvFormat}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="rz-setting-desc">Credenciais Prontas para Cifragem:</span>
                          <span className="rz-badge rz-badge-success">{csvItems.length} itens</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleConfirmCSVImport}
                          disabled={isImportingCSV}
                          className="rz-btn rz-btn-primary rz-btn-block"
                          style={{ marginTop: '4px' }}
                        >
                          <span>
                            {isImportingCSV ? 'Criptografando...' : `Importar ${csvItems.length} credenciais`}
                          </span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="rz-btn rz-btn-ghost rz-btn-block"
                      style={{ border: '1px solid var(--rz-border)' }}
                    >
                      <Download size={16} />
                      <span>Exportar Cofre como Planilha CSV</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* 7. Gerenciamento de Sessões */}
              <section className="rz-section" style={{ marginBottom: 0 }}>
                <div className="rz-section-head">
                  <h2 className="rz-section-title">
                    <Cpu size={16} />
                    Dispositivos Conectados
                  </h2>
                  <span className="rz-badge rz-badge-neutral">{sessions.length} sessões</span>
                </div>

                <div className="rz-panel">
                  <p className="rz-text-muted" style={{ marginBottom: '14px' }}>
                    Veja os dispositivos que acessaram sua conta e gerencie suas conexões ativas.
                  </p>

                  <div className="session-list-container">
                    {sessions.map((s, idx) => (
                      <div key={s.id} className="session-card-item">
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span className="session-device-name">{s.deviceName}</span>
                            {idx === 0 && (
                              <span className="rz-badge rz-badge-success">
                                <span className="rz-dot success is-live" />
                                Atual
                              </span>
                            )}
                          </div>
                          <div className="session-metadata">
                            {s.ipPlaceholder} • Último acesso: {new Date(s.lastActive).toLocaleTimeString()}
                          </div>
                        </div>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(s.id)}
                            className="rz-btn rz-btn-sm rz-btn-danger"
                          >
                            Desconectar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* 8. Wipe de Segurança (Zona de Risco) */}
              <section className="rz-section" style={{ marginBottom: 0 }}>
                <div className="rz-section-head">
                  <h2 className="rz-section-title" style={{ color: 'var(--rz-danger)' }}>
                    <AlertTriangle size={16} />
                    Zona de Risco · Excluir Todos os Dados
                  </h2>
                </div>

                <div className="rz-panel rz-panel-danger">
                  <p className="rz-text-muted" style={{ marginBottom: '14px' }}>
                    Remove permanentemente todas as suas senhas, dados da conta e configurações deste dispositivo. Essa ação é irreversível.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="rz-input-group">
                      <KeyRound size={17} style={{ color: 'var(--rz-danger)' }} />
                      <input
                        type="password"
                        className="rz-input"
                        placeholder="Digite sua senha mestra para confirmar"
                        value={confirmWipePassword}
                        onChange={(e) => setConfirmWipePassword(e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleWipeData}
                      className="rz-btn rz-btn-danger rz-btn-block"
                    >
                      <Trash2 size={16} />
                      <span>Excluir Minha Conta e Dados</span>
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        <MasterKeyModal
          isOpen={showMasterKeyModal}
          onClose={() => setShowMasterKeyModal(false)}
        />

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          color={toastColor}
          duration={3000}
          position="bottom"
        />

        <ConfirmModal
          isOpen={showWipeConfirmModal}
          title="Destruir Todos os Dados Locais?"
          message="Atenção crítica: todas as suas credenciais, chaves criptográficas e configurações salvas serão excluídas permanentemente deste aparelho. Esta ação é irreversível."
          confirmText="Destruir Dados"
          cancelText="Cancelar"
          variant="danger"
          onConfirm={handleExecuteWipe}
          onCancel={() => setShowWipeConfirmModal(false)}
        />

        <ConfirmModal
          isOpen={showDisable2FAConfirm}
          title="Desativar Autenticação em Dois Fatores?"
          message="Atenção: sua conta deixará de exigir códigos temporários para login, reduzindo a camada de proteção contra acessos não autorizados."
          confirmText="Desativar 2FA"
          cancelText="Manter Ativo"
          variant="danger"
          onConfirm={handleDisable2FA}
          onCancel={() => setShowDisable2FAConfirm(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default SettingsPage;
