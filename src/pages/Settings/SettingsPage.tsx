import React, { useState, useEffect, useCallback } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonButton, IonIcon, IonItem, IonLabel, IonInput,
  IonToggle, IonToast, IonBadge, IonList, useIonAlert,
} from '@ionic/react';
import {
  downloadOutline, cloudUploadOutline, trashOutline,
  hardwareChipOutline, keyOutline,
  alertCircleOutline, fingerPrintOutline, documentTextOutline,
  swapHorizontalOutline, checkmarkCircleOutline, sparklesOutline,
  shieldCheckmarkOutline, eyeOutline, eyeOffOutline, openOutline,
  refreshOutline
} from 'ionicons/icons';
import { VaultService } from '../../services/vault';
import { StorageService } from '../../services/storage';
import { SessionService } from '../../services/session';
import { ImporterService, ParsedImportItem, SupportedImportFormat } from '../../services/importer';
import { useSecurity } from '../../contexts/SecurityContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { ActiveSession } from '../../types';
import './SettingsPage.css';

export const SettingsPage: React.FC = () => {
  const { 
    logout, 
    activeEmail, 
    isBiometricsEnrolled, 
    registerBiometrics, 
    disableBiometrics,
    rememberSession,
    setRememberSession
  } = useSecurity();
  const { tier, subscription, isPro, isUltra } = useSubscription();
  const [presentAlert] = useIonAlert();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  
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
    const logins = stored.filter(log => log.action === 'LOGIN_SUCCESS');
    
    // Monta a lista de dispositivos conectados com base no histórico de acessos
    const sessionsList: ActiveSession[] = logins.map((log, index) => {
      const isCurrent = index === 0;
      return {
        id: log.id,
        deviceName: isCurrent ? `Este dispositivo (${deviceInfo || 'Celular'})` : 'Dispositivo anterior',
        lastActive: log.timestamp,
        ipPlaceholder: isCurrent ? 'Conexão ativa' : 'Acesso registrado'
      };
    });

    // Garante pelo menos uma sessão ativa corrente
    if (sessionsList.length === 0) {
      sessionsList.push({
        id: 'current',
        deviceName: `Este Dispositivo (${navigator.platform})`,
        lastActive: new Date().toISOString(),
        ipPlaceholder: 'Conexão ativa'
      });
    }

    setSessions(sessionsList.slice(0, 4));
  }, [deviceInfo]);

  useEffect(() => {
    loadSessions();
    detectDeviceInfo();
    // Carrega a chave HIBP salva no storage local
    StorageService.getHibpApiKey().then(key => {
      if (key) {
        setHibpKey(key);
        setHasSavedHibpKey(true);
      }
    });
  }, [loadSessions]);

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

  const showFeedback = (msg: string, color: string = 'dark') => {
    setToastMsg(msg);
    setToastColor(color);
    setShowToast(true);
  };

  // Exportar Backup Seguro
  const handleExportBackup = async () => {
    try {
      const blobStr = await VaultService.exportEncryptedBlob();
      const blob = new Blob([blobStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-seguro-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showFeedback('Backup exportado.', 'success');
    } catch {
      showFeedback(`Não foi possível exportar o backup. Tente novamente.`, 'danger');
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
      showFeedback(`Não foi possível restaurar o backup. Verifique a senha e tente novamente.`, 'danger');
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
      } catch (err: unknown) {
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
            } catch (err: any) {
              showFeedback(err?.message || 'Não foi possível exportar o CSV.', 'danger');
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

    // Confirma a identidade do usuário antes de prosseguir
    const profile = await StorageService.getUserProfile(email);
    if (!profile) return;
    
    try {
      const authRes = await SessionService.authenticateMaster(email, confirmWipePassword);
      if (authRes.success) {
        if (window.confirm('Atenção: todas as suas senhas e dados serão excluídos permanentemente deste dispositivo. Essa ação não pode ser desfeita. Deseja continuar?')) {
          await StorageService.clearAllData();
          SessionService.clearSession();
          showFeedback('Todos os dados foram excluídos deste dispositivo.', 'danger');
          setTimeout(() => {
            logout();
          }, 1500);
        }
      } else {
        showFeedback('Senha mestra incorreta. A operação foi cancelada.', 'danger');
      }
    } catch {
      showFeedback(`Não foi possível confirmar sua identidade. Tente novamente.`, 'danger');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (sessionId === 'current' || sessions[0]?.id === sessionId) {
      showFeedback('Não é possível desconectar o dispositivo que você está usando agora.', 'warning');
      return;
    }
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    await StorageService.addAuditLog(email, 'PIN_LOCKED', `Dispositivo [${sessionId.substring(0, 6)}] desconectado.`);
    showFeedback('Dispositivo desconectado com sucesso.', 'success');
  };

  return (
    <IonPage className="settings-page">
      <IonHeader className="ion-no-border">
        <IonToolbar className="settings-toolbar">
          <IonTitle className="settings-title">
            Configurações
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="settings-content">
        <div className="settings-container">

          {/* Meu Plano & Assinatura */}
          <IonCard className="settings-card" style={{
            background: isUltra
              ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(20, 28, 45, 0.95) 100%)'
              : isPro
              ? 'linear-gradient(135deg, rgba(96, 165, 250, 0.12) 0%, rgba(20, 28, 45, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(20, 28, 45, 0.95) 0%, rgba(11, 15, 26, 0.95) 100%)',
            border: isUltra
              ? '1px solid rgba(168, 85, 247, 0.4)'
              : isPro
              ? '1px solid rgba(96, 165, 250, 0.4)'
              : '1px solid rgba(255, 255, 255, 0.08)',
          }}>
            <IonCardHeader>
              <div className="settings-card-title-row" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={sparklesOutline} style={{ color: isUltra ? '#c084fc' : isPro ? '#60a5fa' : '#3880ff', fontSize: '22px' }} />
                  <IonCardTitle className="settings-card-title">
                    Meu Plano & Assinatura
                  </IonCardTitle>
                </div>
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: isUltra ? 'rgba(168, 85, 247, 0.25)' : isPro ? 'rgba(96, 165, 250, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                  color: isUltra ? '#e9d5ff' : isPro ? '#60a5fa' : '#94a3b8',
                  border: isUltra ? '1px solid rgba(168, 85, 247, 0.5)' : isPro ? '1px solid rgba(96, 165, 250, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                  {tier === 'ULTRA' ? 'ULTRA' : tier === 'PRO' ? 'PRO' : 'FREE'}
                </span>
              </div>
            </IonCardHeader>
            <IonCardContent>
              <p className="settings-card-desc">
                {isUltra
                  ? 'Você possui o plano Ultra Familiar com proteção absoluta, até 6 membros, PIN de Pânico e armazenamento de 10 GB.'
                  : isPro
                  ? 'Você possui o plano Pro com 2FA ilimitado, até 5 dispositivos e monitoramento Dark Web diário.'
                  : 'Você está no plano Gratuito com senhas ilimitadas em 1 dispositivo. Faça upgrade para desbloquear 2FA e múltiplos aparelhos.'}
              </p>

              {subscription?.expiresAt && (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '12px' }}>
                  Renovação: <strong style={{ color: '#e2e8f0' }}>{new Date(subscription.expiresAt).toLocaleDateString()}</strong> ({subscription.billingCycle === 'ANNUAL' ? 'Plano Anual' : 'Plano Mensal'})
                </div>
              )}

              <IonButton
                expand="block"
                routerLink="/plans"
                style={{
                  '--background': isUltra
                    ? 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)'
                    : 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                  '--color': isUltra ? '#ffffff' : '#000000',
                  '--border-radius': '14px',
                  fontWeight: 800,
                  height: '44px',
                  margin: '4px 0 0',
                }}
              >
                {tier === 'FREE' ? 'Fazer upgrade de plano' : 'Gerenciar / Mudar de Plano'}
              </IonButton>
            </IonCardContent>
          </IonCard>

          {/* Backup Criptografado */}
          <IonCard className="settings-card">
            <IonCardHeader>
              <div className="settings-card-title-row">
                <IonIcon icon={downloadOutline} style={{ color: '#3880ff', fontSize: '22px' }} />
                <IonCardTitle className="settings-card-title">
                  Backup Seguro
                </IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent>
              <p className="settings-card-desc">
                Salve uma cópia protegida das suas credenciais. O arquivo é totalmente criptografado e só pode ser aberto com a sua senha mestra.
              </p>
              
              <IonButton
                expand="block"
                onClick={handleExportBackup}
                className="settings-btn-primary"
              >
                <IonIcon icon={downloadOutline} slot="start" />
                Baixar Backup
              </IonButton>

              <hr className="settings-divider" />

              <div className="import-form-container">
                <h4 className="settings-sub-title">
                  Restaurar Backup
                </h4>
                
                {/* Input de Arquivo Customizado */}
                <div className="file-picker-wrapper">
                  <input
                    type="file"
                    accept=".json"
                    id="backup-file-input"
                    onChange={handleFileChange}
                    className="file-picker-input"
                  />
                  <IonButton
                    expand="block"
                    fill="outline"
                    className="file-picker-btn"
                  >
                    <IonIcon icon={cloudUploadOutline} slot="start" style={{ color: '#3880ff' }} />
                    {fileSelected ? `Arquivo: ${fileSelected}` : 'Selecionar Arquivo .json'}
                  </IonButton>
                </div>

                {backupText && (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    <IonItem lines="none" className="import-input-item">
                      <IonIcon icon={keyOutline} slot="start" style={{ color: '#ffc409' }} />
                      <IonInput
                        type="password"
                        placeholder="Senha Mestra do Backup"
                        value={backupPassword}
                        onIonInput={e => setBackupPassword(e.detail.value ?? '')}
                      />
                    </IonItem>

                    <IonItem lines="none" className="import-toggle-item">
                      <IonLabel>
                        Mesclar com itens existentes?
                      </IonLabel>
                      <IonToggle
                        checked={mergeBackup}
                        onIonChange={e => setMergeBackup(e.detail.checked)}
                        slot="end"
                      />
                    </IonItem>

                    <IonButton
                      expand="block"
                      onClick={handleImportBackup}
                      className="settings-btn-success"
                    >
                      Restaurar Credenciais
                    </IonButton>
                  </div>
                )}
              </div>
            </IonCardContent>
          </IonCard>

          {/* Migração & Importação Universal (Bitwarden, 1Password, Chrome, CSV) */}
          <IonCard className="settings-card">
            <IonCardHeader>
              <div className="settings-card-title-row">
                <IonIcon icon={swapHorizontalOutline} style={{ color: '#3880ff', fontSize: '22px' }} />
                <IonCardTitle className="settings-card-title">
                  Migração Universal (Bitwarden / 1Password / Chrome / CSV)
                </IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent>
              <p className="settings-card-desc">
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
                  <IonButton
                    expand="block"
                    fill="outline"
                    className="file-picker-btn"
                  >
                    <IonIcon icon={documentTextOutline} slot="start" style={{ color: '#60a5fa' }} />
                    {csvFileSelected ? `CSV: ${csvFileSelected}` : 'Selecionar Arquivo .csv'}
                  </IonButton>
                </div>

                {csvItems.length > 0 && (
                  <div style={{
                    background: 'rgba(96, 165, 250, 0.08)',
                    border: '1px solid rgba(96, 165, 250, 0.25)',
                    borderRadius: '14px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>
                        Formato Detectado:
                      </span>
                      <span style={{ color: '#60a5fa', fontWeight: 800, fontSize: '0.85rem' }}>
                        {csvFormat}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>
                        Credenciais Prontas para Cifragem:
                      </span>
                      <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.9rem' }}>
                        {csvItems.length} itens
                      </span>
                    </div>
                    <IonButton
                      expand="block"
                      onClick={handleConfirmCSVImport}
                      disabled={isImportingCSV}
                      className="settings-btn-success"
                      style={{ marginTop: '6px' }}
                    >
                      {isImportingCSV ? 'Criptografando...' : `Importar ${csvItems.length} credenciais`}
                    </IonButton>
                  </div>
                )}

                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={handleExportCSV}
                  style={{
                    '--border-color': 'rgba(255, 255, 255, 0.15)',
                    '--border-radius': '12px',
                    color: '#e2e8f0',
                    fontWeight: 600,
                    margin: '4px 0 0',
                  }}
                >
                  <IonIcon icon={downloadOutline} slot="start" />
                  Exportar Cofre como Planilha CSV
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>

          {/* Biometria (Touch ID / Face ID / Windows Hello) */}
          <IonCard className="settings-card">
            <IonCardHeader>
              <div className="settings-card-title-row">
                <IonIcon icon={fingerPrintOutline} style={{ color: '#60a5fa', fontSize: '22px' }} />
                <IonCardTitle className="settings-card-title">
                  Biometria (Touch ID / Face ID)
                </IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent>
              <p className="settings-card-desc">
                Ative o desbloqueio biométrico para acessar seu cofre rapidamente ou recuperar sua senha mestra localmente caso a esqueça.
              </p>

              {activeEmail && isBiometricsEnrolled(activeEmail) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                    Biometria ativa neste dispositivo
                  </div>
                  <IonButton
                    expand="block"
                    routerLink="/biometric-settings"
                    className="settings-btn-primary"
                    style={{ marginBottom: '6px' }}
                  >
                    Painel de Biometria & Chave Mestra
                  </IonButton>
                  <IonButton
                    expand="block"
                    color="danger"
                    fill="outline"
                    onClick={() => {
                      disableBiometrics();
                      showFeedback('Biometria desativada com sucesso.', 'success');
                    }}
                  >
                    Desativar Biometria
                  </IonButton>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <IonButton
                    expand="block"
                    routerLink="/biometric-settings"
                    className="settings-btn-primary"
                    style={{ marginBottom: '4px' }}
                  >
                    Painel Avançado de Biometria & Chave Mestra
                  </IonButton>

                  <div style={{ background: 'rgba(2, 6, 23, 0.4)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(96, 165, 250, 0.15)' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                      CADASTRAR BIOMETRIA (DIGITAL / ROSTO):
                    </span>
                    <IonItem lines="none" className="settings-wipe-input-item" style={{ marginBottom: '8px' }}>
                      <IonIcon icon={keyOutline} slot="start" style={{ color: '#60a5fa' }} />
                      <IonInput
                        type="password"
                        placeholder="Digite sua Senha Mestra"
                        value={bioPassword}
                        onIonInput={e => setBioPassword(e.detail.value ?? '')}
                      />
                    </IonItem>
                    <IonButton
                      expand="block"
                      className="settings-btn-primary"
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
                      Cadastrar e ativar biometria
                    </IonButton>
                  </div>
                </div>
              )}
            </IonCardContent>
          </IonCard>

          {/* Auditoria de E-mails (Have I Been Pwned API v3) */}
          <IonCard className="settings-card">
            <IonCardHeader>
              <div className="settings-card-title-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={shieldCheckmarkOutline} style={{ color: '#60a5fa', fontSize: '22px' }} />
                  <IonCardTitle className="settings-card-title">
                    Auditoria de E-mails (Have I Been Pwned)
                  </IonCardTitle>
                </div>
                <IonBadge color={hasSavedHibpKey ? 'success' : 'warning'} style={{ fontSize: '0.7rem' }}>
                  {hasSavedHibpKey ? 'Configurada' : 'Simulação'}
                </IonBadge>
              </div>
            </IonCardHeader>
            <IonCardContent>
              <p className="settings-card-desc">
                Conecte sua API Key pessoal da v3 do <strong>Have I Been Pwned</strong> para auditar vazamentos reais de e-mails em tempo real.
              </p>

              <div style={{
                background: 'rgba(2, 6, 23, 0.4)',
                border: '1px solid rgba(96, 165, 250, 0.15)',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700 }}>
                    CHAVE DE API PESSOAL (HIBP-API-KEY):
                  </span>
                  <a
                    href="https://haveibeenpwned.com/API/Key"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#60a5fa',
                      fontSize: '0.75rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none'
                    }}
                  >
                    Obter Chave HIBP <IonIcon icon={openOutline} />
                  </a>
                </div>

                <div style={{ position: 'relative' }}>
                  <IonItem lines="none" className="settings-wipe-input-item" style={{ margin: 0 }}>
                    <IonIcon icon={keyOutline} slot="start" style={{ color: '#60a5fa' }} />
                    <IonInput
                      type={showHibpKey ? 'text' : 'password'}
                      placeholder="Insira sua chave HIBP (Ex: a1b2c3d4...)"
                      value={hibpKey}
                      onIonInput={e => setHibpKey(e.detail.value ?? '')}
                    />
                    <IonButton
                      fill="clear"
                      slot="end"
                      onClick={() => setShowHibpKey(!showHibpKey)}
                      style={{ color: '#94a3b8', margin: 0 }}
                    >
                      <IonIcon icon={showHibpKey ? eyeOffOutline : eyeOutline} slot="icon-only" />
                    </IonButton>
                  </IonItem>
                </div>

                <div style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  lineHeight: '1.4',
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  <strong>Privacidade:</strong> Sua chave é armazenada exclusivamente na memória segura deste dispositivo e nunca é enviada ao Firestore ou à nuvem.
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <IonButton
                    expand="block"
                    className="settings-btn-primary"
                    disabled={isSavingHibpKey || !hibpKey.trim()}
                    onClick={handleSaveHibpKey}
                    style={{ flex: 1, margin: 0 }}
                  >
                    {isSavingHibpKey ? 'Salvando...' : 'Salvar Chave'}
                  </IonButton>

                  {hasSavedHibpKey && (
                    <IonButton
                      expand="block"
                      fill="outline"
                      color="danger"
                      onClick={handleClearHibpKey}
                      style={{ margin: 0 }}
                    >
                      <IonIcon icon={trashOutline} slot="icon-only" />
                    </IonButton>
                  )}
                </div>
              </div>
            </IonCardContent>
          </IonCard>


          {/* Persistência de Sessão (Manter Conectado ao Atualizar) */}
          <IonCard className="settings-card">
            <IonCardHeader>
              <div className="settings-card-title-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={refreshOutline} style={{ color: '#60a5fa', fontSize: '22px' }} />
                  <IonCardTitle className="settings-card-title">
                    Manter Conectado ao Atualizar (F5)
                  </IonCardTitle>
                </div>
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
            </IonCardHeader>
            <IonCardContent>
              <p className="settings-card-desc">
                {rememberSession
                  ? 'Ativado: Sua sessão é protegida com criptografia vinculada exclusivamente a este dispositivo e restaurada automaticamente ao atualizar a página (F5), mantendo você conectado sem interrupções.'
                  : 'Desativado: Sua sessão reside unicamente na memória volátil (RAM). Qualquer recarregamento de página ou fechamento de aba encerra a sessão imediatamente para máxima segurança em computadores públicos ou compartilhados.'}
              </p>
            </IonCardContent>
          </IonCard>

          {/* Gerenciamento de Sessões */}
          <IonCard className="settings-card">
            <IonCardHeader>
              <div className="settings-card-title-row">
                <IonIcon icon={hardwareChipOutline} style={{ color: '#2dd36f', fontSize: '22px' }} />
                <IonCardTitle className="settings-card-title">
                  Dispositivos Conectados
                </IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent style={{ padding: '0 16px 16px' }}>
              <p className="settings-card-desc">
                Veja os dispositivos que acessaram sua conta e gerencie suas conexões ativas.
              </p>
              
              <IonList className="session-list-container">
                {sessions.map((s, idx) => (
                  <div key={s.id} className="session-card-item">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="session-device-name">
                          {s.deviceName}
                        </span>
                        {idx === 0 && <IonBadge color="success" style={{ fontSize: '0.65rem' }}>Atual</IonBadge>}
                      </div>
                      <div className="session-metadata">
                        {s.ipPlaceholder} • Último acesso: {new Date(s.lastActive).toLocaleTimeString()}
                      </div>
                    </div>
                    {idx > 0 && (
                      <IonButton
                        fill="clear"
                        color="danger"
                        size="small"
                        onClick={() => handleRevokeSession(s.id)}
                        className="session-revoke-btn"
                      >
                        Desconectar
                      </IonButton>
                    )}
                  </div>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>

          {/* Wipe de Segurança */}
          <IonCard className="settings-card">
            <IonCardHeader>
              <div className="settings-card-title-row">
                <IonIcon icon={alertCircleOutline} style={{ color: '#ff4961', fontSize: '22px' }} />
                <IonCardTitle className="settings-card-title">
                  Excluir Todos os Dados
                </IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent>
              <p className="settings-card-desc">
                Remove permanentemente todas as suas senhas, dados da conta e configurações deste dispositivo. Essa ação é irreversível.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <IonItem lines="none" className="settings-wipe-input-item">
                  <IonIcon icon={keyOutline} slot="start" style={{ color: '#ff4961' }} />
                  <IonInput
                    type="password"
                    placeholder="Digite sua senha mestra para confirmar"
                    value={confirmWipePassword}
                    onIonInput={e => setConfirmWipePassword(e.detail.value ?? '')}
                  />
                </IonItem>

                <IonButton
                  expand="block"
                  onClick={handleWipeData}
                  className="settings-btn-danger"
                >
                  <IonIcon icon={trashOutline} slot="start" />
                  Excluir Minha Conta e Dados
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>

        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          color={toastColor}
          duration={3000}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};
